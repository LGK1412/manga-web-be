import { Injectable, InternalServerErrorException } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { createHash } from 'crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type ModerationFinding = {
  policy: string;
  reason: string;
  evidence?: string;
  severity?: 'low' | 'medium' | 'high';
};

export type GeminiCheckInput = {
  chapterTitle: string;
  chapterHtml: string;
  policies: Array<{ title: string; content: string; mainType?: string; subCategory?: string }>;
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
    if (!this.apiKey) throw new InternalServerErrorException('GEMINI_API_KEY is missing in .env');
    const genAI = new GoogleGenerativeAI(this.apiKey);
    return genAI.getGenerativeModel({ model: this.modelName });
  }

  private htmlToReadableText(html: string) {
    const clean = sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'ul', 'ol', 'li']),
      allowedAttributes: { a: ['href', 'name', 'target'], '*': ['style'] },
      disallowedTagsMode: 'discard',
    });
    const text = clean.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return { cleanHtml: clean, plainText: text };
  }

  private computeHash(s: string) {
    return createHash('sha256').update(s, 'utf8').digest('hex');
  }

  async check(input: GeminiCheckInput): Promise<GeminiCheckOutput> {
    const { chapterTitle, chapterHtml, policies, policyVersion } = input;

    const { cleanHtml, plainText } = this.htmlToReadableText(chapterHtml || '');
    const contentHash = this.computeHash(cleanHtml || '');

    const policyText = policies
      .map(
        (p, idx) =>
          `#${idx + 1}\nTitle: ${p.title}\nType: ${p.mainType || '-'} / ${p.subCategory || '-'}\nContent:\n${p.content}\n`,
      )
      .join('\n----------------------\n');

    const systemInstruction = `
Bạn là hệ thống kiểm duyệt nội dung. Nhiệm vụ: ĐÁNH GIÁ nội dung chương theo các policy cho trước.

YÊU CẦU:
- Chỉ trả về JSON hợp lệ KHÔNG kèm chú thích, không Markdown.
- JSON schema:
{
  "status": "AI_PASSED" | "AI_WARN" | "AI_BLOCK",
  "risk_score": number (0..100),
  "labels": string[],
  "ai_findings": [
    {
      "policy": string,
      "reason": string,
      "evidence": string,
      "severity": "low" | "medium" | "high"
    }
  ]
}

HƯỚNG DẪN PHÂN LOẠI:
- AI_BLOCK: vi phạm rõ ràng, nặng, chắc chắn phải chặn.
- AI_WARN: có dấu hiệu rủi ro/cần người duyệt xem lại.
- AI_PASSED: không vi phạm chính sách.

Chỉ xuất JSON đúng schema ở trên.
`.trim();

    const userPrompt = `
=== CHÍNH SÁCH (Policy) ===
${policyText}

=== THÔNG TIN CHƯƠNG ===
Title: ${chapterTitle}

=== NỘI DUNG (HTML) ===
${cleanHtml}

=== NỘI DUNG (TEXT) ===
${plainText}
`.trim();

    let rawText = '';
    try {
      const model = this.getModel();
      // Gọi bằng một chuỗi để tương thích SDK
      const result = await model.generateContent(`${systemInstruction}\n\n${userPrompt}`);
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
            reason: 'Gemini API unavailable or error',
            evidence: err?.message || 'No details',
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
            reason: 'Model returned non-JSON or invalid JSON',
            evidence: rawText?.slice(0, 500) || '',
            severity: 'low',
          },
        ],
        policy_version: policyVersion,
        content_hash: contentHash,
        ai_model: this.modelName,
      };
    }

    const status =
      parsed?.status === 'AI_BLOCK' || parsed?.status === 'AI_WARN' || parsed?.status === 'AI_PASSED'
        ? parsed.status
        : 'AI_WARN';

    const risk =
      typeof parsed?.risk_score === 'number' ? Math.max(0, Math.min(100, parsed!.risk_score!)) : 50;

    const labels = Array.isArray(parsed?.labels) ? parsed!.labels!.map(String) : [];

    const findings = Array.isArray(parsed?.ai_findings)
      ? parsed!.ai_findings!.map((f: any) => ({
          policy: String(f?.policy ?? ''),
          reason: String(f?.reason ?? ''),
          evidence: f?.evidence ? String(f.evidence) : undefined,
          severity: f?.severity === 'high' || f?.severity === 'medium' || f?.severity === 'low' ? f.severity : 'low',
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
