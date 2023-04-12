export default function makeClass(...classes: string[]) {
  let names: string = '';
  classes.forEach(c => {if (c && c.length > 0) names += `${c} `});
  return names;
}
