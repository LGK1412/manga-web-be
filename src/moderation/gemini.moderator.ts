import { Injectable, InternalServerErrorException } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { createHash } from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type ModerationFinding = {
  policy: string;
  policy_slug?: string;
  policy_title?: string;
  reason: string;
  evidence?: string;
  spans?: Array<{
    start: number;
    end: number;
  }>;
  severity?: 'low' | 'medium' | 'high';
  advice?: {
    moderator: {
      next_step: 'approve' | 'reject' | 'escalate';
      reason: string;
      checks: string[];
    };
    author: {
      revision_goal: string;
      revision_steps: string[];
      note_draft?: string;
    };
  };
};

export type GeminiCheckInput = {
  chapterTitle: string;
  chapterHtml: string;
  policies: Array<{
    title: string;
    slug?: string;
    content: string;
    mainType?: string;
    subCategory?: string;
  }>;
  policyVersion: string;
};

export type GeminiCheckOutput = {
  status: 'AI_PASSED' | 'AI_WARN' | 'AI_BLOCK';
  risk_score: number;
  labels: string[];
  ai_findings: ModerationFinding[];
  policy_version: string;
  content_hash?: string | null;
  ai_model?: string;
};

@Injectable()
export class GeminiModerator {
  private readonly apiKey = process.env.GEMINI_API_KEY;
  private readonly modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  private getModel() {
    if (!this.apiKey) {
      throw new InternalServerErrorException('GEMINI_API_KEY is missing in .env');
    }

    const genAI = new GoogleGenerativeAI(this.apiKey);
    return genAI.getGenerativeModel({ model: this.modelName });
  }

  private htmlToReadableText(html: string) {
    const clean = sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        'b',
        'i',
        'em',
        'strong',
        'u',
        'br',
        'p',
        'ul',
        'ol',
        'li',
      ]),
      allowedAttributes: { a: ['href', 'name', 'target'], '*': ['style'] },
      disallowedTagsMode: 'discard',
    });

    const text = clean.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return { cleanHtml: clean, plainText: text };
  }

  private computeHash(source: string) {
    return createHash('sha256').update(source, 'utf8').digest('hex');
  }

  private parseStringList(value: unknown) {
    return Array.isArray(value)
      ? value
          .map((item) => String(item ?? '').trim())
          .filter(Boolean)
      : [];
  }

  private parseSpans(value: unknown): ModerationFinding['spans'] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    const spans = value
      .map((item) => {
        const start =
          typeof item?.start === 'number' ? item.start : Number(item?.start);
        const end =
          typeof item?.end === 'number' ? item.end : Number(item?.end);

        if (
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          start < 0 ||
          end <= start
        ) {
          return null;
        }

        return {
          start: Math.floor(start),
          end: Math.floor(end),
        };
      })
      .filter((item): item is { start: number; end: number } => Boolean(item))
      .slice(0, 4);

    return spans.length > 0 ? spans : undefined;
  }

  private parseAdvice(rawAdvice: any): ModerationFinding['advice'] | undefined {
    const rawNextStep = rawAdvice?.moderator?.next_step;
    const nextStep =
      rawNextStep === 'approve' ||
      rawNextStep === 'reject' ||
      rawNextStep === 'escalate'
        ? rawNextStep
        : undefined;

    const moderatorReason = String(rawAdvice?.moderator?.reason ?? '').trim();
    const moderatorChecks = this.parseStringList(rawAdvice?.moderator?.checks);
    const authorRevisionGoal = String(rawAdvice?.author?.revision_goal ?? '').trim();
    const authorRevisionSteps = this.parseStringList(rawAdvice?.author?.revision_steps);
    const authorNoteDraft = String(rawAdvice?.author?.note_draft ?? '').trim();

    if (!nextStep || !moderatorReason || !authorRevisionGoal) {
      return undefined;
    }

    return {
      moderator: {
        next_step: nextStep,
        reason: moderatorReason,
        checks: moderatorChecks.slice(0, 4),
      },
      author: {
        revision_goal: authorRevisionGoal,
        revision_steps: authorRevisionSteps.slice(0, 4),
        note_draft: authorNoteDraft || undefined,
      },
    };
  }

  async check(input: GeminiCheckInput): Promise<GeminiCheckOutput> {
    const { chapterTitle, chapterHtml, policies, policyVersion } = input;

    const { cleanHtml, plainText } = this.htmlToReadableText(chapterHtml || '');
    const contentHash = this.computeHash(cleanHtml || '');

    const policyText = policies
      .map(
        (policy, index) =>
          [
            `#${index + 1}`,
            `Title: ${policy.title}`,
            `Slug: ${policy.slug || 'general'}`,
            `Type: ${policy.mainType || '-'} / ${policy.subCategory || '-'}`,
            'Content:',
            policy.content,
            '',
          ].join('\n'),
      )
      .join('\n----------------------\n');

    const systemInstruction = `
You are a content moderation system. Review the chapter against the provided policies.

Requirements:
- Return valid JSON only. No markdown. No commentary.
- Write every returned string in English, including "reason", "evidence", moderator advice, author guidance, labels, and note drafts.
- If the source content or policy text is in another language, translate your output to natural English.
- JSON schema:
{
  "status": "AI_PASSED" | "AI_WARN" | "AI_BLOCK",
  "risk_score": number (0..100),
  "labels": string[],
  "ai_findings": [
    {
      "policy": string,
      "policy_slug": string,
      "policy_title": string,
      "reason": string,
      "evidence": string,
      "spans": [{ "start": number, "end": number }],
      "severity": "low" | "medium" | "high",
        "advice": {
          "moderator": {
          "next_step": "approve" | "reject" | "escalate",
          "reason": string,
          "checks": string[]
        },
        "author": {
          "revision_goal": string,
          "revision_steps": string[],
          "note_draft": string
        }
      }
    }
  ]
}

Classification guide:
- AI_BLOCK: clear or severe policy violation.
- AI_WARN: risky or ambiguous content that needs moderator review.
- AI_PASSED: no clear policy issue found.

Policy matching rules:
- "policy_slug" must be one exact slug from the provided policy list.
- "policy_title" must match the title for that slug.
- If no policy is clearly matched, use "general" for "policy_slug" and "General Review" for "policy_title".

Evidence rules:
- Each "ai_finding" must describe exactly one distinct violating fragment or one closely connected sentence.
- Do not combine multiple numbered excerpts, bullet lists, or distant passages into a single finding.
- If 5 different excerpts are problematic, return 5 separate "ai_findings".
- "evidence" must be copied verbatim from CHAPTER TEXT, not summarized.
- Keep "evidence" short and precise.
- "spans" must use 0-based character offsets from CHAPTER TEXT, with "end" exclusive.
- If exact offsets are unclear, return an empty "spans" array instead of guessing.

Advice rules:
- The "moderator" advice is for internal staff, not for the author.
- The "author" advice is for revision guidance that can be sent to the author.
- "moderator.next_step" should be:
  - "approve" only if the finding is effectively safe in context.
  - "reject" if the content is not ready for publication and requires revision or is clearly incompatible with posting policy.
  - "escalate" if age, consent, protected-group, or policy interpretation is ambiguous.
- Keep "moderator.reason" concrete and decision-oriented.
- Keep "moderator.checks" as short review checkpoints.
- Keep "author.revision_goal" concise and outcome-focused.
- Keep "author.revision_steps" concrete and editable by the author.
- Keep "author.note_draft" ready to copy into a moderation note.

Return only JSON that matches the schema above.
`.trim();

    const userPrompt = `
=== POLICY LIST ===
${policyText}

=== CHAPTER TITLE ===
${chapterTitle}

=== CHAPTER HTML ===
${cleanHtml}

=== CHAPTER TEXT ===
${plainText}
`.trim();

    let rawText = '';
    try {
      const model = this.getModel();
      const result = await model.generateContent(
        `${systemInstruction}\n\n${userPrompt}`,
      );
      rawText =
        typeof result?.response?.text === 'function'
          ? result.response.text()
          : (result?.response as any)?.text ?? '';
    } catch (err: any) {
      return {
        status: 'AI_WARN',
        risk_score: 50,
        labels: ['ai_unavailable'],
        ai_findings: [
          {
            policy: 'system/fallback',
            reason: 'AI moderation is temporarily unavailable.',
            evidence:
              'The AI provider is temporarily unavailable or has reached its request limit. Please try again later.',
            severity: 'medium',
          },
        ],
        policy_version: policyVersion,
        content_hash: contentHash,
        ai_model: this.modelName,
      };
    }

    let parsed: Partial<GeminiCheckOutput> | null = null;
    try {
      const cleaned = rawText
        .trim()
        .replace(/^```json/i, '')
        .replace(/^```/i, '')
        .replace(/```$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        status: 'AI_WARN',
        risk_score: 40,
        labels: ['parse_error'],
        ai_findings: [
          {
            policy: 'system/format',
            reason: 'AI moderation returned an unreadable response.',
            evidence:
              'The moderation result could not be processed. Please run the AI check again later.',
            severity: 'low',
          },
        ],
        policy_version: policyVersion,
        content_hash: contentHash,
        ai_model: this.modelName,
      };
    }

    const status =
      parsed?.status === 'AI_BLOCK' ||
      parsed?.status === 'AI_WARN' ||
      parsed?.status === 'AI_PASSED'
        ? parsed.status
        : 'AI_WARN';

    const risk =
      typeof parsed?.risk_score === 'number'
        ? Math.max(0, Math.min(100, parsed.risk_score))
        : 50;

    const labels = Array.isArray(parsed?.labels)
      ? parsed.labels.map(String)
      : [];

    const findings = Array.isArray(parsed?.ai_findings)
      ? parsed.ai_findings.map((finding: any) => ({
          policy: String(
            finding?.policy ?? finding?.policy_title ?? finding?.policy_slug ?? '',
          ),
          policy_slug: finding?.policy_slug
            ? String(finding.policy_slug)
            : undefined,
          policy_title: finding?.policy_title
            ? String(finding.policy_title)
            : undefined,
          reason: String(finding?.reason ?? ''),
          evidence: finding?.evidence ? String(finding.evidence) : undefined,
          spans: this.parseSpans(finding?.spans),
          severity:
            finding?.severity === 'high' ||
            finding?.severity === 'medium' ||
            finding?.severity === 'low'
              ? finding.severity
              : 'low',
          advice: this.parseAdvice(finding?.advice),
        }))
      : [];

    return {
      status,
      risk_score: risk,
      labels,
      ai_findings: findings,
      policy_version: policyVersion,
      content_hash: contentHash,
      ai_model: this.modelName,
    };
  }
}
