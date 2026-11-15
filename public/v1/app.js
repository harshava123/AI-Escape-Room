const chat = document.getElementById('chat');
const form = document.getElementById('form');
const input = document.getElementById('input');
let sessionId = Math.random().toString(36).slice(2);

function add(text, cls) {
  const p = document.createElement('p');
  p.className = 'msg ' + cls;
  p.textContent = text;
  chat.appendChild(p);
  chat.scrollTop = chat.scrollHeight;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = input.value;
  input.value = '';
  add(message, 'user');

  const res = await fetch('/api/v1/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message }),
  });
  const data = await res.json();
  add(data.reply, 'ai');
  if (data.escaped) add('*** YOU ESCAPED! ***', 'win');
});

document.getElementById('reset').addEventListener('click', async () => {
  await fetch('/api/v1/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  sessionId = Math.random().toString(36).slice(2);
  chat.innerHTML = '';
  add('The room resets. You wake up again...', 'ai');
});

add('You wake up on a cold floor. Type "look around" to begin.', 'ai');
