async (page) => {
 await page.goto('http://localhost:5173/');
 const original=await page.evaluate(()=>localStorage.getItem('paper-docs'));
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
 try {
  await page.getByRole('button',{name:'New document',exact:true}).click();
  const editor=page.getByRole('textbox',{name:'Markdown editor'});
  const sample='# 测试\n\n**粗体** and *italic*\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```js\nconst a = 1;\n```\n\n---\n\nEnd';
  await page.keyboard.insertText(sample);
  await page.getByRole('button',{name:'Toggle dark theme'}).focus();
  assert(await page.locator('#editor table').count()===1,'table rendering');
  assert(!(await editor.innerText()).includes('```'),'fence hiding');
  await page.locator('#editor td').first().click();
  await page.locator('#editor table').waitFor({state:'detached',timeout:3000});
  await editor.press('Meta+End');
  await editor.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''})));
  await page.keyboard.insertText('中文输入');
  await editor.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中文输入'})));
  await page.getByRole('button',{name:'Toggle Markdown source'}).click();
  assert((await editor.innerText()).includes('End中文输入'),'composition text lost');
  await editor.press('Meta+a');await editor.press('Backspace');
  assert((await page.evaluate(()=>JSON.parse(localStorage.getItem('paper-docs'))[0].text))==='','cross-block deletion');
  await editor.press('Meta+z');
  assert((await page.evaluate(()=>JSON.parse(localStorage.getItem('paper-docs'))[0].text))===sample+'中文输入','cross-block undo');
  await page.getByRole('button',{name:'Toggle Markdown source'}).click();
  await page.getByRole('button',{name:'Toggle dark theme'}).focus();
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'mobile horizontal overflow');
  assert(!errors.length,errors.join('\n'));
  return 'PASS: table reveal, code fences, composition events, Chinese input, cross-block deletion/undo, mobile width';
 } finally {
  await page.evaluate(value=>localStorage.setItem('paper-docs',value),original);
  await page.setViewportSize({width:1200,height:800});await page.reload();
  await page.screenshot({path:'output/playwright/live-editor.png'});
 }
}
