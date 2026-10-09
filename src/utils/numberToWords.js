const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function below100(n) {
  if (n < 20) return ones[n]
  return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
}

function below1000(n) {
  if (n < 100) return below100(n)
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + below100(n % 100) : '')
}

export function numberToWords(n) {
  const totalPaise = Math.round((Number(n) || 0) * 100)
  const num = Math.floor(totalPaise / 100)
  const paise = totalPaise % 100
  const paiseText = paise ? ` and ${below100(paise)} Paise` : ''
  if (num === 0) return paise ? `${below100(paise)} Paise Only` : 'Zero Rupees Only'

  let parts = []
  let rem = num

  const crore = Math.floor(rem / 10000000); rem %= 10000000
  const lakh  = Math.floor(rem / 100000);   rem %= 100000
  const thou  = Math.floor(rem / 1000);     rem %= 1000
  const rest  = rem

  if (crore) parts.push(below1000(crore) + ' Crore')
  if (lakh)  parts.push(below1000(lakh)  + ' Lakh')
  if (thou)  parts.push(below1000(thou)  + ' Thousand')
  if (rest)  parts.push(below1000(rest))

  return parts.join(' ') + ' Rupees' + paiseText + ' Only'
}
