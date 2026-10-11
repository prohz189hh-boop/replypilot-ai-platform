(() => {
  const script = document.currentScript;
  const business = script && script.getAttribute('data-business');
  if (!business || !/^[a-f0-9-]{36}$/i.test(business)) return;
  const origin = new URL(script.src).origin;
  const frame = document.createElement('iframe');
  frame.src = origin + '/chat/' + encodeURIComponent(business);
  frame.title = 'Customer support from ReplyPilot';
  frame.style.cssText = 'position:fixed;bottom:88px;right:20px;width:min(420px,calc(100vw - 40px));height:min(650px,75vh);border:1px solid #dce6e2;border-radius:18px;box-shadow:0 15px 55px #1234;z-index:2147483646;background:white;display:none';
  frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms');
  const button = document.createElement('button');
  button.textContent = 'Chat with us';
  button.setAttribute('aria-expanded','false');
  button.style.cssText = 'position:fixed;bottom:22px;right:22px;border:0;border-radius:30px;padding:17px 23px;background:#087f74;color:white;font:600 15px system-ui;z-index:2147483647;cursor:pointer;box-shadow:0 6px 20px #1233';
  button.addEventListener('click',()=>{const open=frame.style.display==='none';frame.style.display=open?'block':'none';button.textContent=open?'Close chat':'Chat with us';button.setAttribute('aria-expanded',String(open));});
  document.body.append(frame,button);
})();
