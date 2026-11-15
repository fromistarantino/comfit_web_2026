/* COMFIT 사이트 런타임: 페이지 안의 <template id="dc">를 상태에 맞게 그리고, 바뀐 부분만 고친다. */
(function () {
  var tpl = document.getElementById('dc'), codeEl = document.getElementById('dc-code'), app = document.getElementById('app');
  if (!tpl || !codeEl || !app) return;
  var inst, pending = false;
  function DCLogic(p) { this.props = p || {}; this.state = {}; }
  DCLogic.prototype.setState = function (o) {
    if (typeof o === 'function') o = o(this.state);
    this.state = Object.assign({}, this.state, o);
    if (!pending) { pending = true; Promise.resolve().then(function () { pending = false; render(); }); }
  };
  var C = new Function('DCLogic', codeEl.textContent + '; return Component;')(DCLogic);
  inst = new C({});
  var HOLE = /\{\{([^}]+)\}\}/g, ONE = /^\{\{([^}]+)\}\}$/;
  function look(scope, p) { var v = scope, ks = p.trim().split('.'); for (var i = 0; i < ks.length; i++) { if (v == null) return undefined; v = v[ks[i]]; } return v; }
  function fill(s, scope) { return s.replace(HOLE, function (_, p) { var v = look(scope, p); return v == null ? '' : v; }); }
  function listen(el, ev) {
    if (!el.__l) el.__l = {};
    if (el.__l[ev]) return; el.__l[ev] = true;
    el.addEventListener(ev, function (e) { var f = el.__h && el.__h[ev]; if (f) f(e); });
  }
  function build(node, scope, out) {
    if (node.nodeType === 3) { out.appendChild(document.createTextNode(fill(node.nodeValue, scope))); return; }
    if (node.nodeType !== 1) return;
    var tag = node.tagName.toLowerCase(), m, i;
    if (tag === 'sc-if') { m = ONE.exec(node.getAttribute('value') || ''); if (m && look(scope, m[1])) for (i = 0; i < node.childNodes.length; i++) build(node.childNodes[i], scope, out); return; }
    if (tag === 'sc-for') {
      m = ONE.exec(node.getAttribute('list') || ''); var as = node.getAttribute('as'), list = (m && look(scope, m[1])) || [];
      list.forEach(function (it) { var s2 = Object.assign({}, scope); s2[as] = it; for (var j = 0; j < node.childNodes.length; j++) build(node.childNodes[j], s2, out); });
      return;
    }
    var el = node.namespaceURI === 'http://www.w3.org/2000/svg' ? document.createElementNS(node.namespaceURI, node.tagName) : document.createElement(tag);
    el.__h = {}; el.__p = {};
    for (i = 0; i < node.attributes.length; i++) {
      var a = node.attributes[i], name = a.name, one = ONE.exec(a.value);
      if (name.indexOf('hint-') === 0) continue;
      if (/^on[a-z]+$/.test(name)) {
        var fn = one ? look(scope, one[1]) : null, ev = name.slice(2);
        if (ev === 'change' && (tag === 'textarea' || (tag === 'input' && !/checkbox|radio|file/.test(node.getAttribute('type') || 'text')))) ev = 'input';
        if (typeof fn === 'function') el.__h[ev] = fn;
        continue;
      }
      if (one) {
        var v = look(scope, one[1]);
        if (name === 'checked') { el.__p.checked = !!v; if (v) el.setAttribute('checked', ''); }
        else if (name === 'disabled') { if (v) el.setAttribute('disabled', ''); }
        else if (name === 'value' && /^(input|select|textarea)$/.test(tag)) { el.__p.value = v == null ? '' : String(v); if (tag === 'input') el.setAttribute('value', el.__p.value); }
        else if (v === true || v === false) { if (v || name.indexOf('aria-') === 0) el.setAttribute(name, String(v)); }
        else if (v != null) el.setAttribute(name, v);
        continue;
      }
      el.setAttribute(name, fill(a.value, scope));
    }
    for (i = 0; i < node.childNodes.length; i++) build(node.childNodes[i], scope, el);
    out.appendChild(el);
  }
  function wire(el) {
    if (el.nodeType !== 1) return;
    if (el.__h) for (var ev in el.__h) listen(el, ev);
    if (el.__p) { if ('value' in el.__p) el.value = el.__p.value; if ('checked' in el.__p) el.checked = el.__p.checked; }
    for (var c = el.firstChild; c; c = c.nextSibling) wire(c);
  }
  function morph(parent, src) {
    var news = Array.prototype.slice.call(src.childNodes), old = parent.firstChild;
    news.forEach(function (nw) {
      if (!old) { parent.appendChild(nw); wire(nw); return; }
      var next = old.nextSibling;
      if (old.nodeType === 3 && nw.nodeType === 3) { if (old.nodeValue !== nw.nodeValue) old.nodeValue = nw.nodeValue; }
      else if (old.nodeType === 1 && nw.nodeType === 1 && old.nodeName === nw.nodeName) {
        var i, a;
        for (i = old.attributes.length - 1; i >= 0; i--) { a = old.attributes[i]; if (!nw.hasAttribute(a.name) && !(a.name === 'open' && old.nodeName === 'DETAILS')) old.removeAttribute(a.name); }
        for (i = 0; i < nw.attributes.length; i++) { a = nw.attributes[i]; if (old.getAttribute(a.name) !== a.value) old.setAttribute(a.name, a.value); }
        old.__h = nw.__h || {}; for (var ev in old.__h) listen(old, ev);
        morph(old, nw);
        var p = nw.__p || {};
        if ('value' in p && old.value !== p.value) old.value = p.value;
        if ('checked' in p && old.checked !== p.checked) old.checked = p.checked;
      } else { parent.replaceChild(nw, old); wire(nw); }
      old = next;
    });
    while (old) { var n = old.nextSibling; parent.removeChild(old); old = n; }
  }
  function render() {
    var vals = inst.renderVals(), frag = document.createDocumentFragment();
    var kids = tpl.content.childNodes;
    for (var i = 0; i < kids.length; i++) build(kids[i], vals, frag);
    frag.normalize();
    morph(app, frag);
  }
  app.normalize();
  render();
  if (inst.componentDidMount) inst.componentDidMount();
  window.addEventListener('pagehide', function () { if (inst.componentWillUnmount) inst.componentWillUnmount(); });
})();
