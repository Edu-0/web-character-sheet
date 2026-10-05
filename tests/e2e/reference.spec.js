import {test,expect} from '@playwright/test';
test('registro executável corresponde à referência e todos os layouts embutidos validam @smoke',async({page})=>{
  await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)');
  const result=await page.evaluate(async()=>{
    const fields=await import('/js/engine/fields.js'),contracts=await import('/js/validation/contracts.js'),repo=await import('/js/repositories/system-repository.js'),schemas=await import('/js/validation/schemas.js');
    const issues=[];for(const system of repo.listSystems()) issues.push(...schemas.validateSystemPackage(await repo.getSystemPackage(system.id)));
    return {registered:fields.registeredFieldTypes().sort(),documented:Object.keys(contracts.COMPONENT_CONTRACTS).sort(),issues};
  });expect(result.registered).toEqual(result.documented);expect(result.issues).toEqual([]);
});
