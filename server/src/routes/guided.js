import { Router } from 'express'
import { z } from 'zod'
import { optionalAuth } from '../lib/session.js'
import { asyncHandler, badRequest } from '../lib/errors.js'
import { getQuiz, recommend, saveTasteProfile } from '../store/guided.js'

const router = Router()

// One value per question (all optional — an unanswered/"no preference" question
// is just omitted or an empty string). .strict() rejects stray keys.
const answersSchema = z
  .object({
    roast: z.string().max(40).optional(),
    flavor: z.string().max(40).optional(),
    body: z.string().max(40).optional(),
    brew: z.string().max(40).optional(),
  })
  .strict()

const recommendSchema = z.object({ answers: answersSchema.default({}) }).strict()

// GET /api/guided/quiz — the questions + options for the "Find your coffee" wizard.
router.get(
  '/guided/quiz',
  asyncHandler(async (req, res) => {
    res.json({ quiz: getQuiz() })
  }),
)

// POST /api/guided/recommend — score the (Salesforce) catalog against the
// shopper's answers. optionalAuth so it works for guests; when a shopper is
// logged in we also persist their taste profile onto their Salesforce Contact.
router.post(
  '/guided/recommend',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const parsed = recommendSchema.safeParse(req.body || {})
    if (!parsed.success) throw badRequest('Invalid quiz answers.', 'invalid_answers')
    const { answers } = parsed.data
    const recommendations = await recommend(answers)
    if (req.user?.id) await saveTasteProfile(req.user.id, answers)
    res.json({ recommendations })
  }),
)

export default router
