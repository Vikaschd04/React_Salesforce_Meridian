import { Router } from 'express'
import { z } from 'zod'
import { signup, authenticate } from '../store/auth.js'
import { setSessionCookie, clearSessionCookie, readSession } from '../lib/session.js'
import { asyncHandler, badRequest } from '../lib/errors.js'

const router = Router()

const signupSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().email().max(120),
    password: z.string().min(8).max(200),
    // Optional: "buying for a company" — resolved server-side by work-email
    // domain (see store/companies.js). Omit/blank for an individual signup.
    companyName: z.string().trim().min(1).max(120).optional(),
  })
  .strict()

const loginSchema = z
  .object({
    email: z.string().trim().email().max(120),
    password: z.string().min(1).max(200),
  })
  .strict()

function validate(schema, body) {
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw badRequest(first?.message || 'Invalid request.', 'invalid_input')
  }
  return parsed.data
}

// POST /api/auth/signup — create account + start session
router.post(
  '/auth/signup',
  asyncHandler(async (req, res) => {
    const data = validate(signupSchema, req.body)
    const user = await signup(data)
    setSessionCookie(res, user)
    res.status(201).json(user)
  }),
)

// POST /api/auth/login — verify credentials + start session
router.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const data = validate(loginSchema, req.body)
    const user = await authenticate(data)
    setSessionCookie(res, user)
    res.json(user)
  }),
)

// POST /api/auth/logout — clear session
router.post('/auth/logout', (req, res) => {
  clearSessionCookie(res)
  res.json({ ok: true })
})

// GET /api/auth/me — current profile or 401
router.get('/auth/me', (req, res) => {
  const user = readSession(req)
  if (!user) return res.status(401).json({ error: 'unauthorized', message: 'Not logged in.' })
  res.json(user)
})

export default router
