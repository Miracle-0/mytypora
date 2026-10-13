async (page) => {
 await page.goto("http://localhost:5173/");
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const original=await page.evaluate(()=>localStorage.getItem('paper-docs'));
 const assert=(ok,message)=>{if(!ok)throw new Error(message);};
 try {
  await page.getByRole('button',{name:'New document',exact:true}).click();
  const editor=page.getByRole('textbox',{name:'Markdown editor'});
  await editor.pressSequentially('# Heading\n\nHello **bold** and *italic*.\n\nLast line.');
  await page.getByRole('button',{name:'Toggle dark theme'}).focus();
  assert(await page.locator('.live-strong').textContent()==='bold','bold markers not hidden');
  assert(await page.locator('.live-h1').textContent()==='Heading','heading not rendered');
  await page.locator('.live-strong').click();
  assert((await page.locator('.live-strong').textContent()).includes('**'),'cursor did not reveal syntax');
  await editor.press('End');
  await page.getByRole('button',{name:'Toggle Markdown source'}).click();
  assert((await editor.innerText()).includes('**bold**'),'source missing original Markdown');
  await page.getByRole('button',{name:'Toggle Markdown source'}).click();
  await editor.press('Meta+End');await editor.pressSequentially(' Added');
  await editor.press('Meta+z');
  assert(!(await editor.innerText()).includes(' Added'),'undo failed');
  await editor.press('Meta+Shift+z');
  assert((await editor.innerText()).includes(' Added'),'redo failed');
  await page.reload();
  assert((await page.getByRole('textbox',{name:'Markdown editor'}).innerText()).includes(' Added'),'persist failed');
  await page.getByRole('textbox',{name:'Markdown editor'}).click();
  await page.keyboard.press('Meta+End');await page.keyboard.press('Enter');
  await page.keyboard.insertText('- [ ] task');await page.keyboard.press('Enter');
  assert((await page.getByRole('textbox',{name:'Markdown editor'}).innerText()).includes('- [ ]'),'list continuation failed');
  await page.getByRole('button',{name:'Toggle dark theme'}).focus();
  await page.getByRole('checkbox',{name:'Toggle task'}).first().check();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('paper-docs'))[0].text);
  assert(saved.includes('[x] task'),'task update failed');
  assert(!errors.length,errors.join('\n'));
  return 'PASS: cursor reveal/hide, heading, continuous input, undo/redo, mode switch, persistence, task toggle';
 } finally {
  await page.evaluate(value=>localStorage.setItem('paper-docs',value),original);await page.reload();
 }
}
