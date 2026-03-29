#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const BATCH_SIZE = 200;

function printUsage() {
  console.log(`
Backfill Manga.licenseRejectReasons from existing reject reason fields.

Usage:
  node scripts/backfill-license-reject-reasons.js --dry-run
  node scripts/backfill-license-reject-reasons.js --apply

Flags:
  --dry-run  Preview the changes without writing to MongoDB.
  --apply    Write the normalized licenseRejectReasons array to MongoDB.
  --help     Show this message.
`);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#') || line.startsWith('//')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
      continue;
    }

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).replace(/\\n/g, '\n');
    }

    process.env[key] = value;
  }
}

function normalizeRejectReason(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function pushUniqueReason(target, value) {
  const normalized = normalizeRejectReason(value);

  if (!normalized || target.includes(normalized)) {
    return;
  }

  target.push(normalized);
}

function buildRejectReasonHistory(doc) {
  const history = [];

  if (Array.isArray(doc.licenseRejectReasons)) {
    for (const reason of doc.licenseRejectReasons) {
      pushUniqueReason(history, reason);
    }
  }

  pushUniqueReason(history, doc.licenseRejectReason);
  pushUniqueReason(history, doc.rights && doc.rights.rejectReason);

  return history;
}

function sameHistory(current, next) {
  if (!Array.isArray(current) || current.length !== next.length) {
    return false;
  }

  for (let index = 0; index < current.length; index += 1) {
    if (current[index] !== next[index]) {
      return false;
    }
  }

  return true;
}

async function flushBulk(collection, operations) {
  if (operations.length === 0) {
    return 0;
  }

  const result = await collection.bulkWrite(operations, { ordered: false });
  return Number(result.modifiedCount || 0);
}

async function main() {
  const args = new Set(process.argv.slice(2));

  if (args.has('--help') || args.has('-h')) {
    printUsage();
    return;
  }

  const apply = args.has('--apply');
  const dryRun = !apply || args.has('--dry-run');

  loadEnvFile(path.resolve(process.cwd(), '.env'));

  const uri = process.env.DATABASE_URL;

  if (!uri) {
    throw new Error(
      'DATABASE_URL is missing. Set it in the environment or in the .env file.',
    );
  }

  await mongoose.connect(uri);

  const collection = mongoose.connection.collection('mangas');
  const cursor = collection.find(
    {
      $or: [
        { licenseRejectReason: { $exists: true } },
        { licenseRejectReasons: { $exists: true } },
        { 'rights.rejectReason': { $exists: true } },
      ],
    },
    {
      projection: {
        _id: 1,
        title: 1,
        licenseRejectReason: 1,
        licenseRejectReasons: 1,
        'rights.rejectReason': 1,
      },
    },
  );

  let scanned = 0;
  let toUpdate = 0;
  let updated = 0;
  const operations = [];
  const samples = [];

  console.log(
    `[backfill] Starting ${dryRun ? 'dry-run' : 'apply'} for manga license reject history...`,
  );

  for await (const doc of cursor) {
    scanned += 1;

    const currentHistory = Array.isArray(doc.licenseRejectReasons)
      ? doc.licenseRejectReasons
      : [];
    const nextHistory = buildRejectReasonHistory(doc);

    if (sameHistory(currentHistory, nextHistory)) {
      continue;
    }

    toUpdate += 1;

    if (samples.length < 10) {
      samples.push({
        _id: String(doc._id),
        title: doc.title || '(untitled)',
        from: currentHistory,
        to: nextHistory,
      });
    }

    if (dryRun) {
      continue;
    }

    operations.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            licenseRejectReasons: nextHistory,
          },
        },
      },
    });

    if (operations.length >= BATCH_SIZE) {
      updated += await flushBulk(collection, operations);
      operations.length = 0;
    }
  }

  if (!dryRun) {
    updated += await flushBulk(collection, operations);
  }

  console.log(`[backfill] Scanned ${scanned} manga documents.`);
  console.log(
    `[backfill] ${dryRun ? 'Would update' : 'Updated'} ${dryRun ? toUpdate : updated} documents.`,
  );

  if (samples.length > 0) {
    console.log('[backfill] Sample changes:');

    for (const sample of samples) {
      console.log(
        `- ${sample._id} | ${sample.title}\n  from: ${JSON.stringify(sample.from)}\n  to:   ${JSON.stringify(sample.to)}`,
      );
    }
  } else {
    console.log('[backfill] No changes needed.');
  }
}

main()
  .catch((error) => {
    console.error('[backfill] Failed:', error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
