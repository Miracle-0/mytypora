async (page) => {
 await page.goto('http://localhost:5173/');
 const original=await page.evaluate(()=>localStorage.getItem('paper-docs'));
 const viewport=page.viewportSize();
 const sample='# A title\n\nIntro paragraph.\n\n## Another heading\n\n### Third heading\n\nSome words above the quotation.\n\n> Simplicity boils down to two steps: identify the essential. Eliminate the rest.\n> \n> — Leo Babauta\n\nFinal paragraph.';
 const results=[];
 try {
  await page.getByRole('button',{name:'New document',exact:true}).click();
  await page.keyboard.insertText(sample);
  for(const width of [1200,390]) {
   if(width<800 && await page.locator('.sidebar').isVisible()) await page.getByRole('button',{name:'Toggle sidebar',exact:true}).click();
   await page.setViewportSize({width,height:800});
   for(const word of ['Simplicity','Babauta','Final paragraph.']) {
    await page.getByRole('button',{name:'Toggle dark theme'}).focus();
    const line=page.locator('.cm-line').filter({hasText:word}).first();
    await line.scrollIntoViewIfNeeded();
    // Measure the real glyph, not a guessed line-height or container offset.
    const hit=await line.evaluate(async (el,word)=>{
     await document.fonts.ready;
     await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
     const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
     let node;
     while(node=walker.nextNode()) {
      const at=node.textContent.indexOf(word);if(at<0)continue;
      const range=document.createRange();range.setStart(node,at+3);range.setEnd(node,at+4);
      const box=range.getBoundingClientRect();return {x:box.left+1,y:(box.top+box.bottom)/2};
     }
     throw new Error('Target text was not rendered');
    },word);
    await page.mouse.click(hit.x,hit.y);
    await page.keyboard.insertText('¦');
    const result=await page.evaluate(()=>JSON.parse(localStorage.getItem('paper-docs'))[0].text);
    const expected=sample.indexOf(word)+3, actual=result.indexOf('¦');
    if(actual!==expected) throw new Error(`${width}px ${word}: expected ${expected}, got ${actual}`);
    results.push(`${width}px ${word}: exact character match`);
    await page.getByRole('textbox',{name:'Markdown editor'}).press('Meta+z');
   }
  }
  return results;
 } finally {
  await page.evaluate(value=>localStorage.setItem('paper-docs',value),original);
  if(viewport)await page.setViewportSize(viewport);
  await page.reload();
 }
}
