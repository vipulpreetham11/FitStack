export function brandVariables(input?: string | null) {
  const color = /^#[0-9a-f]{6}$/i.test(input ?? '') ? input! : '#171717'
  const rgb = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16))
  const linear = rgb.map(n => n / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  const luminance = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722
  return { '--brand-primary': color, '--brand-on-primary': luminance > .179 ? '#000000' : '#ffffff', '--brand-primary-light': '#' + rgb.map(v => Math.round(v + (255-v)*.9).toString(16).padStart(2,'0')).join('') }
}
