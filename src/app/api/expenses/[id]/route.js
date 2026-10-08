import Expense from '@/lib/models/Expense'
import { route, readJson, json, pick, assertObjectId, ApiError } from '@/lib/api'
import { EXPENSE_FIELDS, expenseTarget } from '@/lib/expenseFields'

async function findExpense(scope, id) {
  assertObjectId(id, 'Expense')
  const expense = await Expense.findOne({ _id: id, ...scope.filter({}, 'orgId') })
  if (!expense) throw new ApiError(404, 'Expense not found.')
  return expense
}

export const PUT = route(async ({ request, params, scope, audit }) => {
  const expense = await findExpense(scope, params.id)
  const before = { amount: expense.amount, date: expense.date, category: expense.category }
  expense.set(pick(await readJson(request), EXPENSE_FIELDS))
  await expense.save()
  await audit('expense.update', { target: expenseTarget(expense), details: { amountFrom: before.amount, amountTo: expense.amount, date: expense.date } })
  return json(expense)
}, { permission: 'expenses.manage' })

export const DELETE = route(async ({ params, scope, audit }) => {
  const expense = await findExpense(scope, params.id)
  await expense.deleteOne()
  await audit('expense.delete', { target: expenseTarget(expense), details: { amount: expense.amount, date: expense.date, category: expense.category } })
  return json({ ok: true })
}, { permission: 'expenses.manage' })
