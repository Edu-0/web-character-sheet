import {test,expect} from '@playwright/test';

test('gerador seguro real atende engine e bandeja sem Math.random ou edição da ficha @smoke', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  const result = await page.evaluate(async () => {
    const {rollOne,resolve} = await import('/js/engine/dice-resolver.js');
    const {rollCheck} = await import('/js/engine/checks.js');
    const {state} = await import('/js/state.js');
    const before = structuredClone(state.get());
    const native = crypto.getRandomValues.bind(crypto);
    let calls = 0;
    crypto.getRandomValues = array => { calls++; return native(array); };
    Math.random = () => { throw new Error('Math.random não deve gerar dados'); };
    const faces = [3,6,20,100,100000].map(sides => ({sides,rolls:Array.from({length:20},() => rollOne(sides))}));
    const trait = resolve({type:'trait',dice:[{sides:12},{sides:6}]});
    const fate = rollCheck('fate',{value:0});
    const damage = rollCheck('explodingDamage',{value:'2d6'});
    return {faces,trait,fate,damage,calls,unchanged:JSON.stringify(before) === JSON.stringify(state.get())};
  });
  expect(result.calls).toBeGreaterThanOrEqual(108);
  expect(result.unchanged).toBe(true);
  for (const {sides,rolls} of result.faces) for (const face of rolls) {
    expect(Number.isInteger(face) && face >= 1 && face <= sides).toBe(true);
  }
  expect(result.trait.rolls).toHaveLength(2);
  expect(result.fate.total).toBeGreaterThanOrEqual(-4);
  expect(result.fate.total).toBeLessThanOrEqual(4);
  expect(result.damage.groups).toHaveLength(2);
  await page.locator('#btn-dice-toggle').click();
  await page.getByLabel('Rolagem personalizada').fill('2d6 + 1d8 - 2');
  await page.getByRole('button',{name:'Rolar expressão'}).click();
  await expect(page.locator('#dice-result')).toContainText('2d6 + 1d8 - 2 =');
  const entry = await page.evaluate(async () => (await import('/js/dice.js')).getHistory()[0]);
  expect(entry.rolls).toHaveLength(3);
  expect(entry.total).toBe(entry.rolls.reduce((sum,value) => sum + value,0) - 2);
});
