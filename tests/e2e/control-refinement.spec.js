import {test,expect} from '@playwright/test';
const ready=async page=>{await page.goto('/');await expect(page.locator('#shell-current-system')).toHaveText('D&D 5e (2024)',{timeout:15000});};
async function feature(page){await ready(page);await page.evaluate(async()=>(await import('/js/state.js')).state.setPath('features',[{id:'moon',name:'Passo lunar',source:'Classe',usesCurrent:2,usesMax:3,description:'Caminha pela luz da lua.\nConserva os detalhes.',notes:'Nota da mesa'}]));await page.locator('#generic-sheet-host').getByRole('tab',{name:'Habilidades',exact:true}).click();await page.getByRole('button',{name:'Editar Passo lunar',exact:true}).click();return page.locator('dialog.engine-entry-editor[open]');}

test('recuperação usa radios e ajuste manual explícito, com teclado e rascunho cancelável',async({page})=>{
  const box=await feature(page),group=box.getByRole('group',{name:'Recuperar usos em'});
  await expect(group.getByRole('radio')).toHaveCount(3);await expect(group.getByRole('checkbox')).toHaveCount(0);
  const manual=group.getByRole('radio',{name:'Ajuste manual',exact:true}),short=group.getByRole('radio',{name:'Descanso curto ou longo',exact:true}),long=group.getByRole('radio',{name:'Somente descanso longo',exact:true});
  await expect(manual).toBeChecked();await short.check();await expect(manual).not.toBeChecked();await short.focus();await page.keyboard.press('ArrowDown');await expect(long).toBeChecked();await expect(short).not.toBeChecked();
  expect(await page.evaluate(async()=>(await import('/js/state.js')).state.get().features[0].recoverOn)).toBeUndefined();
  await box.getByRole('button',{name:'Salvar',exact:true}).click();expect(await page.evaluate(async()=>(await import('/js/state.js')).state.get().features[0].recoverOn)).toBe('longRest');
  await page.getByRole('button',{name:'Editar Passo lunar',exact:true}).click();await manual.check();await box.getByRole('button',{name:'Cancelar',exact:true}).click();expect(await page.evaluate(async()=>(await import('/js/state.js')).state.get().features[0].recoverOn)).toBe('longRest');
});

test('grupos exclusivos não interferem entre si; alias antigo e valor desconhecido preservam dados',async({page})=>{
  await ready(page);await page.evaluate(async()=>{
    const {createOptionRadios}=await import('/js/engine/option-radios.js'),{createOptionCheckboxes}=await import('/js/engine/option-checkboxes.js');
    window.choiceValues=[];const root=document.createElement('section');root.id='choice-lab';document.body.prepend(root);
    for(const [label,make,value]of [['Primeiro',createOptionRadios,'a'],['Segundo',createOptionCheckboxes,'b'],['Desconhecido',createOptionRadios,'old']])root.append(make({label,options:[{value:'a',label:'A'},{value:'b',label:'B'}],value,onChange:next=>window.choiceValues.push([label,next])}).element);
    const label=document.createElement('label');label.textContent='Opção independente';const checkbox=document.createElement('input');checkbox.type='checkbox';label.append(checkbox);root.append(label);
  });
  const first=page.getByRole('group',{name:'Primeiro',exact:true}),second=page.getByRole('group',{name:'Segundo',exact:true}),unknown=page.getByRole('group',{name:'Desconhecido',exact:true});
  expect(await first.getByRole('radio').first().getAttribute('name')).not.toBe(await second.getByRole('radio').first().getAttribute('name'));
  expect(await page.evaluate(()=>window.choiceValues)).toEqual([]);await expect(unknown.getByRole('status')).toContainText('old');
  await page.getByRole('checkbox',{name:'Opção independente'}).check();await first.getByRole('radio',{name:'Ajuste manual'}).check();
  await expect(second.getByRole('radio',{name:'B',exact:true})).toBeChecked();await expect(page.getByRole('checkbox',{name:'Opção independente'})).toBeChecked();
  await unknown.getByRole('radio',{name:'Ajuste manual'}).check();expect(await page.evaluate(()=>window.choiceValues)).toEqual([['Primeiro',''],['Desconhecido','']]);
});

test('foco único, superfícies claras neutras e paletas preservadas em 320/768/1280',async({page},testInfo)=>{
  test.setTimeout(90000);const box=await feature(page),name=box.getByLabel('Nome',{exact:true});const accents=new Set();
  for(const theme of ['light','dark'])for(const palette of ['classic','editorial','forest','ruby','monochrome','petals']){
    await page.evaluate(async({theme,palette})=>{const ui=await import('/js/theme.js');ui.applyPalette(palette);ui.applyTheme(theme);},{theme,palette});
    for(const width of [320,768,1280]){
      await page.setViewportSize({width,height:1000});await name.focus();
      const styles=await name.evaluate(el=>{const s=getComputedStyle(el),root=getComputedStyle(document.documentElement);return{outline:s.outlineWidth,border:s.borderTopColor,accent:root.getPropertyValue('--color-accent-strong').trim(),bg:s.backgroundColor,body:root.getPropertyValue('--color-bg').trim(),panel:getComputedStyle(el.closest('dialog')).backgroundColor,radius:getComputedStyle(el.closest('dialog')).borderRadius,height:el.getBoundingClientRect().height,overflow:el.closest('dialog').scrollWidth>el.closest('dialog').clientWidth};});
      expect(styles.outline).toBe('0px');expect(styles.overflow).toBe(false);expect(styles.height).toBeGreaterThanOrEqual(44);expect(styles.bg).not.toBe(styles.panel);expect(parseFloat(styles.radius)).toBeLessThanOrEqual(8);
      const saveBounds=await box.getByRole('button',{name:'Salvar',exact:true}).boundingBox();expect(saveBounds.y+saveBounds.height).toBeLessThanOrEqual(1000);
      if(theme==='light'){expect(styles.body).toBe(palette==='monochrome'?'#f6f6f6':'#f7f5f8');accents.add(styles.accent);}
      if(['classic','petals','editorial'].includes(palette)&&width!==768)await box.screenshot({path:testInfo.outputPath(`controls-${palette}-${theme}-${width}.png`)});
    }
  }
  expect(accents.size).toBe(6);await page.keyboard.press('Escape');
});
