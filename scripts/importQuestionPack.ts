#!/usr/bin/env ts-node
/**
 * Import d'un pack de questions via Node (Firebase Admin).
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json npx ts-node scripts/importQuestionPack.ts --file ./packs/questions_pack_example.json
 *   npx ts-node scripts/importQuestionPack.ts --file ./pack.json --dry-run
 */

import fs from 'fs/promises'
import * as fsSync from 'fs'
import path from 'path'
import { applicationDefault, cert, getApp, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { validateQuestionPack, type QuestionPackV1, type QuestionV1 } from '../src/domain/questions/types'

type Args = {
  file: string | null
  dryRun: boolean
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  let file: string | null = null
  let dryRun = false
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--file' && args[i + 1]) {
      file = args[i + 1]
      i++
    } else if (arg === '--dry-run') {
      dryRun = true
    }
  }
  return { file, dryRun }
}

async function loadJson(filePath: string): Promise<any> {
  const abs = path.resolve(process.cwd(), filePath)
  const content = await fs.readFile(abs, 'utf8')
  return JSON.parse(content)
}

function initAdmin() {
  if (getApps().length) return getApp()
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT
  if (credPath) {
    return initializeApp({
      credential: cert(JSON.parse(fsSync.readFileSync(credPath, 'utf8'))),
    })
  }
  return initializeApp({
    credential: applicationDefault(),
  })
}

async function writePack(pack: QuestionPackV1, dryRun: boolean) {
  if (dryRun) {
    console.info(`[dry-run] Pack ${pack.pack.setId} valide (${pack.questions.length} questions).`)
    return
  }
  initAdmin()
  const db = getFirestore()
  const batch = db.batch()
  const nowIso = new Date().toISOString()

  const packRef = db.collection('questionPacks').doc(pack.pack.setId)
  batch.set(packRef, {
    ...pack.pack,
    totalQuestions: pack.questions.length,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })

  pack.questions.forEach((q: QuestionV1) => {
    const history = Array.isArray(q.quality?.history) ? q.quality.history : []
    const questionRef = db.collection('questions').doc(q.id)
    batch.set(questionRef, {
      ...q,
      setId: pack.pack.setId,
      quality: {
        ...q.quality,
        status: 'draft',
        history: [
          ...history,
          { at: nowIso, by: 'import_script', action: 'created', status: 'draft', details: `pack:${pack.pack.setId}` },
        ],
        review: q.quality?.review || { reviewedAt: null, reviewedBy: null, decision: null, notes: null },
        deletedAt: null,
        deletedBy: null,
      },
      createdAt: q.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
  })

  await batch.commit()
  console.info(`✅ Import pack ${pack.pack.setId} terminé (${pack.questions.length} questions).`)
}

async function main() {
  const { file, dryRun } = parseArgs()
  if (!file) {
    console.error('Paramètre --file requis (chemin vers le JSON pack).')
    process.exit(1)
  }
  let data: QuestionPackV1
  try {
    data = await loadJson(file)
  } catch (e) {
    console.error(`Impossible de lire ${file}:`, e)
    process.exit(1)
  }

  const validation = validateQuestionPack(data)
  if (!validation.ok) {
    console.error('❌ Pack invalide :')
    validation.errors.forEach(err => console.error(' -', err))
    process.exit(1)
  }

  await writePack(data, dryRun)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
