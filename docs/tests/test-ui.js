// Loads the admin panel in a simulated browser, logs in, opens every page and reports JS errors.
const { JSDOM, VirtualConsole } = require('jsdom');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push(e.message));
vc.on('error', e => errors.push(String(e)));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dom = await JSDOM.fromURL('http://localhost:8787/', { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  w.fetch = (u, o) => fetch(new URL(u, 'http://localhost:8787').href, o);
  w.confirm = () => true;
  await new Promise(r => w.addEventListener('load', r));
  const $ = s => w.document.querySelector(s);

  $('#loginPassword').value = 'admin12345';
  $('#loginForm').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await sleep(800);
  console.log('Logged in:', !$('#app').classList.contains('hidden'));

  // create a client through the modal
  $('#newClientBtn').click();
  const f = $('#clientForm');
  const F = n => f.elements.namedItem(n);
  const uname = 'uitest' + Date.now().toString().slice(-5);
  F('username').value = uname;
  F('whatsapp').value = '923001112233'; F('selling_price').value = '2000'; F('purchase_price').value = '700';
  f.dispatchEvent(new w.Event('submit', { cancelable: true }));
  await sleep(800);
  console.log('Package modal open:', $('#packageModal').classList.contains('open'), '| WhatsApp link:', !!$('#sendPackage').href);

  // edit + renew through the UI
  w.document.querySelector('#nav a[data-view="clients"]').click(); await sleep(600);
  const c = w.clientsCache.find(x => x.username === uname);
  w.clientAction(c.id, 'edit'); await sleep(100);
  F('display_name').value = 'Edited Name';
  f.dispatchEvent(new w.Event('submit', { cancelable: true })); await sleep(700);
  w.clientAction(c.id, 'renew'); await sleep(100);
  $('#renewForm').elements.namedItem('days').value = '10';
  $('#renewForm').dispatchEvent(new w.Event('submit', { cancelable: true })); await sleep(700);
  const after = w.clientsCache.find(x => x.username === uname);
  console.log('Edit saved:', after.display_name === 'Edited Name', '| Renew saved:', after.days_remaining === 40, '| No duplicate:', w.clientsCache.filter(x => x.username === uname).length === 1);

  for (const v of ['dashboard', 'clients', 'expiry', 'notices', 'pricing', 'devices', 'activity', 'settings']) {
    w.document.querySelector(`#nav a[data-view="${v}"]`).click();
    await sleep(500);
    const txt = $('#view').textContent.trim();
    console.log(v.padEnd(10), txt.startsWith('Loading') ? 'STILL LOADING' : 'OK', '-', txt.slice(0, 60).replace(/\s+/g, ' '));
  }

  // clean up the test client
  const row = [...w.document.querySelectorAll('#nav a')].find(a => a.dataset.view === 'clients'); row.click(); await sleep(500);
  console.log('Client rows:', w.document.querySelectorAll('#clientRows tr').length);
  console.log('JS errors:', errors.length ? errors : 'none');
  w.close();
})();
