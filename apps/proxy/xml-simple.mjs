/**
 * Minimal dependency-free XML → JSON converter.
 *
 * Purpose-built for the Seoul bus.go.kr REST APIs (XML-only). It keeps only
 * what those payloads need: element names + text content, repeated siblings
 * collected into arrays, self-closing tags, ignored attributes/comments/PI.
 * Mixed text-with-children is dropped (the Seoul payloads never mix).
 *
 * Repeated-sibling rule:
 *   <a><b>1</b><b>2</b></a>  →  { a: { b: ['1', '2'] } }
 * Edge cases it tolerates: xml declaration, DOCTYPE, CDATA, self-closing.
 */

function tokenize(text) {
  const tokens = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const lt = text.indexOf('<', i);
    if (lt === -1) {
      tokens.push({ type: 'text', text: text.slice(i) });
      break;
    }
    if (lt > i) tokens.push({ type: 'text', text: text.slice(i, lt) });
    const gt = text.indexOf('>', lt);
    if (gt === -1) {
      tokens.push({ type: 'text', text: text.slice(lt) });
      break;
    }
    let raw = text.slice(lt + 1, gt);
    if (raw.startsWith('?') || raw.startsWith('!--') || raw.startsWith('!')) {
      i = gt + 1; // declaration / comment / doctype: skip, no internal subset support
      continue;
    }
    if (raw.startsWith('/')) {
      tokens.push({ type: 'close', name: raw.slice(1).trim().split(/\s/)[0] });
    } else {
      const selfClosing = /\/$/.test(raw);
      const body = raw.replace(/\/$/, '');
      const m = /^([^\s>]+)/.exec(body);
      tokens.push({ type: selfClosing ? 'self' : 'open', name: m ? m[1] : body });
    }
    i = gt + 1;
  }
  return tokens;
}

function toJson(node) {
  if (node.children.length === 0) {
    return node.text.replace(/\s+/g, ' ').trim();
  }
  const obj = {};
  for (const child of node.children) {
    const wrapped = toJson(child);
    if (Object.prototype.hasOwnProperty.call(obj, child.name)) {
      if (!Array.isArray(obj[child.name])) obj[child.name] = [obj[child.name]];
      obj[child.name].push(wrapped);
    } else {
      obj[child.name] = wrapped;
    }
  }
  return obj;
}

export function xmlToJson(text) {
  const tokens = tokenize(String(text ?? ''));
  const root = { name: '#doc', children: [], text: '' };
  const stack = [root];
  for (const t of tokens) {
    const top = stack[stack.length - 1];
    if (t.type === 'text') {
      if (top.children.length === 0) top.text += t.text;
      continue;
    }
    if (t.type === 'open') {
      const node = { name: t.name, children: [], text: '' };
      top.children.push(node);
      stack.push(node);
      continue;
    }
    if (t.type === 'self') {
      top.children.push({ name: t.name, children: [], text: '' });
      continue;
    }
    // close: tolerate mismatch by scanning down for the matching name
    if (stack.length > 1) {
      if (stack[stack.length - 1].name === t.name) {
        stack.pop();
      } else {
        const idx = stack.map((n) => n.name).lastIndexOf(t.name);
        if (idx >= 1) stack.length = idx;
      }
    }
  }
  // Return the whole doc keyed by its single root element name.
  return toJson(root);
}