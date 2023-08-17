export default function formatNumber(number, options = {}) {
  const num = new Intl.NumberFormat().format(number);
  if (options.decimal && !num.includes('.')) {
    return `${num}.0`
  } else {
    return num
  }
}