export const EXPENSE_FIELDS = ['date', 'category', 'amount', 'paidTo', 'method', 'note']

export const expenseTarget = e => ({ kind: 'expense', id: e._id.toString(), label: `${e.category}${e.paidTo ? ` · ${e.paidTo}` : ''}` })
