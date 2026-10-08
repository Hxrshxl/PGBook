import Expense from '@/lib/models/Expense'
import { route, readJson, json, pick } from '@/lib/api'
import { recordedBy } from '@/lib/paymentLookup'
import { EXPENSE_FIELDS, expenseTarget } from '@/lib/expenseFields'

export const GET = route(async ({ scope }) => {
  const expenses = await Expense.find(scope.filter({}, 'orgId')).sort({ date: -1, createdAt: -1 })
  return json(expenses)
}, { permission: 'expenses.view' })

export const POST = route(async ({ request, org, scope, actor, audit }) => {
  const body = await readJson(request)
  const property = await scope.defaultProperty(body.propertyId)
  const expense = await Expense.create({ ...pick(body, EXPENSE_FIELDS), orgId: org._id, propertyId: property._id, recordedBy: recordedBy(actor) })
  await audit('expense.create', { target: expenseTarget(expense), details: { amount: expense.amount, date: expense.date, category: expense.category } })
  return json(expense, 201)
}, { permission: 'expenses.manage' })
