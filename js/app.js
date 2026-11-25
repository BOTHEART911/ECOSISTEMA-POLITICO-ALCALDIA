/* Ecosistema Digital de Campaña · Oscar Polanía
   Efectos al desplazarse, medios diferidos, modo claro/oscuro, service worker
   y generador de propuesta (un solo viaje al backend). */
(function(){
'use strict';
var V = self.EP_VERSION || '';
var T0 = performance.now();
var $ = function(s,c){return (c||document).querySelector(s);};
var $$ = function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s));};
document.documentElement.classList.add('js');
$('#ver').textContent = V; $('#anio').textContent = new Date().getFullYear();

/* ---------- medición de pantalla ---------- */
var MED = {};
function marca(k){ MED[k] = Math.round(performance.now()); }
addEventListener('load', function(){
  var n = performance.getEntriesByType('navigation')[0];
  MED.carga = Math.round(n ? n.loadEventStart : performance.now());
  try{ new PerformanceObserver(function(l){ var e=l.getEntries(); if(e.length) MED.lcp=Math.round(e[e.length-1].startTime); }).observe({type:'largest-contentful-paint',buffered:true}); }catch(e){}
  try{ console.info('[EP] tiempos de pantalla (ms):', MED); }catch(e){}
});

/* ---------- modo claro / oscuro ---------- */
var raiz = document.documentElement, btnT = $('#btnTema');
function oscuroAhora(){ var t=raiz.dataset.tema; return t==='oscuro' || (t==='auto' && matchMedia('(prefers-color-scheme: dark)').matches); }
function pintaTema(){ btnT.innerHTML = '<svg><use href="#'+(oscuroAhora()?'i-sun':'i-moon')+'"/></svg>'; }
btnT.addEventListener('click', function(){
  raiz.dataset.tema = oscuroAhora() ? 'claro' : 'oscuro';
  try{ localStorage.setItem('ep_tema', raiz.dataset.tema); }catch(e){}
  pintaTema();
});
pintaTema();

/* ---------- barra y progreso ---------- */
var barra = $('#barra'), prog = $('#progreso'), pend = false;
function alDesplazar(){
  pend = false;
  var y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
  barra.classList.toggle('solida', y > 40);
  prog.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0) + ')';
}
addEventListener('scroll', function(){ if(!pend){ pend = true; requestAnimationFrame(alDesplazar); } }, {passive:true});
alDesplazar();

/* ---------- aviso «la propuesta está al final»: visible mientras se recorre, se retira al llegar al cierre ---------- */
(function(){
  var av = $('#avisoFinal'), cierre = $('#cierre'); if(!av || !cierre) return;
  var enCierre = false;
  function pon(){ av.classList.toggle('oculto', enCierre || !$('#modal').hidden); }
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(e){ enCierre = e[0].isIntersecting; pon(); }, {rootMargin:'0px 0px -35% 0px'}).observe(cierre);
  }
  addEventListener('scroll', function(){ requestAnimationFrame(pon); }, {passive:true});
  document.addEventListener('ep:modal', pon);
  pon();
})();

/* ---------- revelado + números que cuentan ---------- */
function cuenta(el){
  var fin = parseFloat(el.dataset.n), dec = +(el.dataset.dec||0), suf = el.dataset.suf||'', mil = el.dataset.mil, t0 = null, dur = 1400;
  function fmt(v){
    var s = dec ? v.toFixed(dec).replace('.', ',') : String(Math.round(v));
    if(mil) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return s + suf;
  }
  function paso(t){ if(t0===null) t0=t; var p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3); el.textContent=fmt(fin*e); if(p<1) requestAnimationFrame(paso); }
  requestAnimationFrame(paso);
}
if('IntersectionObserver' in window){
  var io = new IntersectionObserver(function(ents){
    ents.forEach(function(e){
      if(!e.isIntersecting) return;
      var el = e.target; el.classList.add('ver'); io.unobserve(el);
      $$('.num', el).forEach(cuenta); if(el.classList.contains('num')) cuenta(el);
    });
  }, {threshold:.18, rootMargin:'0px 0px -6% 0px'});
  $$('.rev,.rev-der,.rev-arr,.barras').forEach(function(el){ io.observe(el); });
}else{ $$('.rev,.rev-der,.rev-arr,.barras').forEach(function(el){ el.classList.add('ver'); }); }

/* ---------- videos: se cargan al llegar a la sección y se pausan al salir ----------
   Para cambiar un pantallazo por su video: poner la ruta en data-video="vid/xxx.mp4"
   (la imagen queda como fija mientras carga). */
var vio = 'IntersectionObserver' in window ? new IntersectionObserver(function(ents){
  ents.forEach(function(e){
    var f = e.target, v = f.querySelector('video');
    if(e.isIntersecting){
      if(!v && !f.dataset.sonido){ v = armaVideo(f, true); }
      if(v && v.muted){ var p = v.play(); if(p && p.catch) p.catch(function(){}); }
    }else if(v){ v.pause(); }
  });
}, {threshold:.35}) : null;
function armaVideo(f, mudo){
  var img = f.querySelector('img'), v = document.createElement('video');
  v.src = f.dataset.video; v.playsInline = true; v.preload = 'metadata'; v.poster = img ? (img.currentSrc||img.src) : '';
  v.muted = !!mudo; v.loop = !!mudo; v.setAttribute('playsinline',''); if(!mudo) v.controls = true;
  v.width = img ? img.width : 0; v.height = img ? img.height : 0;
  v.addEventListener('loadeddata', function(){ if(img) img.remove(); }, {once:true});
  f.insertBefore(v, f.firstChild);
  return v;
}
$$('.medio[data-video]').forEach(function(f){
  if(!f.dataset.video) return;
  if(f.dataset.sonido){
    f.addEventListener('click', function(){
      var v = f.querySelector('video') || armaVideo(f, false);
      f.classList.add('sonando'); v.muted = false; var p=v.play(); if(p&&p.catch) p.catch(function(){});
    });
    if(vio) vio.observe(f);
  } else if(vio) vio.observe(f);
});

/* ---------- video de YouTube: PC el horizontal, celular el Short (patrón de Tutoriales de JHONNY PRIV) ---------- */
(function(){
  var f = $('#yt'); if(!f) return;
  var img = $('.yt__img', f), enlace = $('#ytEnlace'), mq = matchMedia('(max-width: 767px), (pointer: coarse) and (max-width: 1024px)');
  var modo = '';
  function fuentes(cel){
    var id = cel ? f.dataset.cel : f.dataset.pc;
    return cel ? ['https://i.ytimg.com/vi/'+id+'/oar2.jpg','https://i.ytimg.com/vi/'+id+'/maxresdefault.jpg','https://i.ytimg.com/vi/'+id+'/hqdefault.jpg']
               : ['https://i.ytimg.com/vi/'+id+'/maxresdefault.jpg','https://i.ytimg.com/vi/'+id+'/hqdefault.jpg'];
  }
  function pinta(){
    if(f.classList.contains('sonando')) return;            // no se cambia mientras se reproduce
    var cel = mq.matches, m = cel ? 'cel' : 'pc'; if(m === modo) return; modo = m;
    f.classList.toggle('yt--short', cel);
    var L = fuentes(cel), i = 0;
    img.classList.remove('sin'); img.width = cel ? 540 : 1280; img.height = cel ? 960 : 720;
    img.onerror = function(){ i++; if(i < L.length) img.src = L[i]; else img.classList.add('sin'); };
    img.onload = function(){ if(img.naturalWidth === 120 && i < L.length-1){ i++; img.src = L[i]; } };   // maxres inexistente = gris 120×90
    img.src = L[0];
    $('.yt__t', f).textContent = cel ? f.dataset.tituloCel : f.dataset.tituloPc;
    enlace.href = cel ? 'https://youtube.com/shorts/'+f.dataset.cel : 'https://youtu.be/'+f.dataset.pc;
  }
  function reproducir(){
    if(f.classList.contains('sonando')) return;
    var id = modo === 'cel' ? f.dataset.cel : f.dataset.pc;
    f.classList.add('sonando');
    var fr = document.createElement('iframe');
    fr.src = 'https://www.youtube-nocookie.com/embed/'+encodeURIComponent(id)+'?autoplay=1&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3';
    fr.title = $('.yt__t', f).textContent; fr.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; fr.allowFullscreen = true;
    f.appendChild(fr); marca('video');
  }
  f.addEventListener('click', reproducir);
  if(mq.addEventListener) mq.addEventListener('change', pinta); else if(mq.addListener) mq.addListener(pinta);
  pinta();
})();

/* ---------- service worker en modo fresco ---------- */
if('serviceWorker' in navigator){
  addEventListener('load', function(){
    navigator.serviceWorker.register('sw.js', {updateViaCache:'none'}).then(function(r){ r.update(); }).catch(function(){});
  });
  var habia = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', function(){
    if(!habia){ habia = true; return; }              // primera instalación: no recarga
    var k = 'ep_recarga_' + V;
    try{ if(sessionStorage.getItem(k)) return; sessionStorage.setItem(k,'1'); }catch(e){ return; }
    if(!$('#modal').hidden) return;                   // no interrumpe un formulario abierto
    location.reload();
  });
}

/* =====================================================================
   GENERADOR DE PROPUESTA
   ===================================================================== */
var modal = $('#modal'), form = $('#fProp'), pasos = $$('.paso', modal), puntos = $$('.pasitos i', modal);
var fCand = $('#fCand'), fMun = $('#fMun'), lMun = $('#lMun'), copias = $('#copias'), btnCopia = $('#btnCopia');
var estado = {dep:'', mun:'', rid:'', enviando:false, abierto:0};
var DOM_CACHE = {};
var COMUNES = ['gmail.com','hotmail.com','outlook.com','yahoo.com','yahoo.es','hotmail.es','outlook.es','live.com','icloud.com','msn.com','une.net.co','gmail.co'];
var foco = null;

function irPaso(n){
  pasos.forEach(function(p){ p.hidden = +p.dataset.paso !== n; });
  puntos.forEach(function(p,i){ p.classList.toggle('on', i < n); });
  var p = pasos[n-1], f = p && p.querySelector('input,button'); if(f) setTimeout(function(){ f.focus({preventScroll:true}); }, 60);
}
function abrir(){
  foco = document.activeElement; modal.hidden = false; document.body.classList.add('bloq'); estado.abierto = performance.now();
  cargaDivipola(); irPaso(1); document.dispatchEvent(new Event('ep:modal'));
}
function cerrar(){
  if(estado.enviando) return;
  modal.hidden = true; document.body.classList.remove('bloq'); if(foco && foco.focus) foco.focus(); document.dispatchEvent(new Event('ep:modal'));
}
$$('[data-abrir-propuesta]').forEach(function(b){ b.addEventListener('click', abrir); });
$$('[data-cerrar]', modal).forEach(function(b){ b.addEventListener('click', cerrar); });
addEventListener('keydown', function(e){ if(e.key==='Escape' && !modal.hidden) cerrar(); });

/* --- lista DIVIPOLA guardada en la web (se trae al abrir el formulario) --- */
var divi = null;
function cargaDivipola(){
  if(divi || self.DIVIPOLA){ divi = self.DIVIPOLA; return; }
  var s = document.createElement('script'); s.src = 'js/divipola.js?v=' + V;
  s.onload = function(){ divi = self.DIVIPOLA; if(estado.dep) activaMun(); };
  document.head.appendChild(s);
}
function sinTilde(s){ return s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); }

/* --- campo con mensaje --- */
function msg(clave, txt, tipo){
  var m = $('[data-msg="'+clave+'"]', modal); if(!m) return;
  m.className = 'msg' + (tipo ? ' '+tipo : ''); m.innerHTML = txt || '';
  var c = m.closest('.campo'); if(c){ c.classList.toggle('mal', tipo==='' && !!txt); c.classList.toggle('bien', tipo==='ok'); }
}

/* --- candidato: mínimo 2 palabras --- */
function validaCand(){
  var v = fCand.value.replace(/\s+/g,' ').trim(), ok = v.split(' ').filter(function(w){return w.length>1;}).length >= 2;
  msg('candidato', ok ? '' : (v ? 'Escriba nombre y apellido.' : 'Escriba el nombre del candidato.'), ok ? 'ok' : '');
  return ok;
}
fCand.addEventListener('blur', function(){ if(fCand.value) validaCand(); });

/* --- departamento → municipio --- */
$$('input[name=departamento]', form).forEach(function(r){
  r.addEventListener('change', function(){
    estado.dep = r.value; estado.mun = ''; fMun.value = ''; msg('departamento','', 'ok'); activaMun(); fMun.focus();
  });
});
function activaMun(){ fMun.disabled = false; fMun.placeholder = 'Escriba o elija el municipio'; }
var selIdx = -1;
function listaMun(){
  if(!divi || !estado.dep) return;
  var q = sinTilde(fMun.value.trim()), arr = divi[estado.dep].m;
  var r = arr.filter(function(x){ return !q || sinTilde(x[1]).indexOf(q) >= 0; })
             .sort(function(a,b){ var A=sinTilde(a[1]).indexOf(q)===0, B=sinTilde(b[1]).indexOf(q)===0; return (B-A) || a[1].localeCompare(b[1],'es'); });
  selIdx = -1;
  lMun.innerHTML = r.length ? r.map(function(x,i){ return '<li role="option" id="m'+i+'" data-v="'+x[1]+'">'+x[1]+'<small>'+x[0]+'</small></li>'; }).join('') : '<li class="vacio">Sin coincidencias en '+estado.dep+'</li>';
  lMun.hidden = false; fMun.setAttribute('aria-expanded','true');
}
function eligeMun(v){ estado.mun = v; fMun.value = v; lMun.hidden = true; fMun.setAttribute('aria-expanded','false'); msg('municipio','','ok'); }
fMun.addEventListener('focus', listaMun);
fMun.addEventListener('input', function(){ estado.mun=''; listaMun(); });
fMun.addEventListener('keydown', function(e){
  var items = $$('li[data-v]', lMun); if(!items.length) return;
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){ e.preventDefault(); selIdx = (selIdx + (e.key==='ArrowDown'?1:-1) + items.length) % items.length;
    items.forEach(function(li,i){ li.setAttribute('aria-selected', i===selIdx); }); items[selIdx].scrollIntoView({block:'nearest'}); fMun.setAttribute('aria-activedescendant', items[selIdx].id); }
  else if(e.key==='Enter'){ e.preventDefault(); eligeMun((items[selIdx]||items[0]).dataset.v); }
});
lMun.addEventListener('mousedown', function(e){ var li = e.target.closest('li[data-v]'); if(li){ e.preventDefault(); eligeMun(li.dataset.v); } });
fMun.addEventListener('blur', function(){
  setTimeout(function(){
    lMun.hidden = true; fMun.setAttribute('aria-expanded','false');
    if(!estado.mun && fMun.value && divi && estado.dep){
      var exacto = divi[estado.dep].m.filter(function(x){ return sinTilde(x[1])===sinTilde(fMun.value.trim()); })[0];
      if(exacto) eligeMun(exacto[1]); else msg('municipio','Elija un municipio de la lista de '+estado.dep+'.','');
    }
  }, 120);
});

/* --- correos: formato + dominio que recibe correo (DNS de Google) + sugerencia --- */
var RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}$/;
function lev(a,b){ var m=[],i,j; for(i=0;i<=b.length;i++)m[i]=[i]; for(j=0;j<=a.length;j++)m[0][j]=j;
  for(i=1;i<=b.length;i++)for(j=1;j<=a.length;j++)m[i][j]=b[i-1]===a[j-1]?m[i-1][j-1]:Math.min(m[i-1][j-1]+1,m[i][j-1]+1,m[i-1][j]+1); return m[b.length][a.length]; }
function sugerencia(c){
  var p = c.split('@'), d = (p[1]||'').toLowerCase(); if(!d || COMUNES.indexOf(d)>=0) return '';
  var mejor = '', dist = 3;
  COMUNES.forEach(function(x){ var k = lev(d,x); if(k < dist){ dist = k; mejor = x; } });
  return mejor ? p[0]+'@'+mejor : '';
}
function dominioRecibe(dom){
  if(DOM_CACHE[dom]) return DOM_CACHE[dom];
  var ctl = new AbortController(), t = setTimeout(function(){ ctl.abort(); }, 4000);
  function q(tipo){ return fetch('https://dns.google/resolve?name='+encodeURIComponent(dom)+'&type='+tipo, {signal:ctl.signal, cache:'force-cache'}).then(function(r){ return r.json(); }); }
  DOM_CACHE[dom] = q('MX').then(function(j){
    if(j.Status===0 && j.Answer && j.Answer.some(function(a){ return a.type===15; })) return 'si';
    if(j.Status===3) return 'no';                                   // el dominio no existe
    return q('A').then(function(k){ return (k.Status===0 && k.Answer && k.Answer.length) ? 'si' : 'no'; });
  }).catch(function(){ delete DOM_CACHE[dom]; return 'sin-red'; })   // sin red o DNS caído: no bloquea
    .then(function(r){ clearTimeout(t); return r; });
  return DOM_CACHE[dom];
}
function validaCorreo(inp, clave){
  var v = inp.value.trim().toLowerCase(), dot = inp.parentNode.querySelector('.estado-c');
  inp.value = v; inp.dataset.ok = '';
  if(!v){ dot.className='estado-c'; msg(clave, clave==='c0'?'Escriba el correo.':'', ''); return Promise.resolve(clave!=='c0'); }
  if(!RE.test(v)){ dot.className='estado-c mal'; msg(clave,'El correo no tiene un formato válido.',''); return Promise.resolve(false); }
  var sug = sugerencia(v);
  dot.className = 'estado-c cargando'; msg(clave, 'Verificando el dominio…', 'info');
  return dominioRecibe(v.split('@')[1]).then(function(r){
    if(inp.value.trim().toLowerCase() !== v) return false;
    var extra = sug ? ' ¿Quiso decir <button type="button" data-sug="'+sug+'">'+sug+'</button>?' : '';
    if(r==='no'){ dot.className='estado-c mal'; msg(clave,'Ese dominio no recibe correo.'+extra,''); return false; }
    inp.dataset.ok = '1'; dot.className = 'estado-c ok';
    msg(clave, sug ? 'Verifique la escritura.'+extra : (r==='si' ? 'Correo verificado.' : ''), sug ? 'info' : 'ok');
    return true;
  });
}
function enlazaCorreo(inp, clave){
  var t; inp.addEventListener('input', function(){ clearTimeout(t); inp.dataset.ok=''; t = setTimeout(function(){ if(inp.value.indexOf('@')>0) validaCorreo(inp, clave); }, 650); });
  inp.addEventListener('blur', function(){ clearTimeout(t); validaCorreo(inp, clave); });
}
enlazaCorreo($('#fCorreo0'), 'c0');
modal.addEventListener('click', function(e){
  var b = e.target.closest('[data-sug]'); if(!b) return;
  var campo = b.closest('.campo'), inp = campo.querySelector('.inCorreo'); inp.value = b.dataset.sug;
  validaCorreo(inp, campo.querySelector('.msg').dataset.msg);
});
var nCopia = 0;
btnCopia.addEventListener('click', function(){
  if($$('.inCorreo', copias).length >= 3) return;
  nCopia++; var k = 'c'+nCopia, d = document.createElement('div');
  d.className = 'campo';
  d.innerHTML = '<label for="fC'+k+'">Copia a otro correo</label><div class="correo"><input id="fC'+k+'" class="inCorreo" type="email" inputmode="email" maxlength="120" placeholder="otro@dominio.com"><span class="estado-c"></span><button type="button" class="quitar" aria-label="Quitar este correo"><svg><use href="#i-x"/></svg></button></div><small class="msg" data-msg="'+k+'"></small>';
  copias.appendChild(d);
  var inp = d.querySelector('input'); enlazaCorreo(inp, k); inp.focus();
  d.querySelector('.quitar').addEventListener('click', function(){ d.remove(); btnCopia.hidden = false; });
  btnCopia.hidden = $$('.inCorreo', copias).length >= 3;
});

/* --- paso 1 → resumen --- */
form.addEventListener('submit', function(e){
  e.preventDefault();
  var ok = validaCand();
  if(!estado.dep){ msg('departamento','Elija el departamento.',''); ok = false; }
  if(!estado.mun){ msg('municipio','Elija el municipio de la lista.',''); ok = false; }
  var ins = $$('.inCorreo', modal);
  Promise.all(ins.map(function(i){ var c=i.closest('.campo').querySelector('.msg').dataset.msg; return i.dataset.ok ? true : validaCorreo(i, c); }))
  .then(function(rs){
    var correos = ins.map(function(i){ return i.value.trim().toLowerCase(); }).filter(String);
    var unicos = correos.filter(function(c,i){ return correos.indexOf(c)===i; });
    if(rs.indexOf(false) >= 0 || !correos.length) ok = false;
    if(!ok){ var m = $('.campo.mal', modal); if(m) m.scrollIntoView({block:'center',behavior:'smooth'}); return; }
    estado.datos = {candidato: fCand.value.replace(/\s+/g,' ').trim(), departamento: estado.dep, municipio: estado.mun, correos: unicos};
    estado.rid = estado.rid || nuevoRid();
    $('#resumen').innerHTML =
      fila('Candidato', estado.datos.candidato) + fila('Municipio', estado.datos.municipio + ' · ' + estado.datos.departamento) +
      fila('Correo', estado.datos.correos[0]) + (unicos.length>1 ? fila('Copias', unicos.slice(1).map(esc).join('<br>')) : '') +
      fila('Envío', 'Propuesta en PDF desde opolania11@gmail.com');
    $('#msgEnvio').textContent = ''; irPaso(2);
  });
});
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function fila(k,v){ return '<div><dt>'+k+'</dt><dd>'+(k==='Copias'?v:esc(v))+'</dd></div>'; }
function nuevoRid(){ var a = new Uint8Array(9); crypto.getRandomValues(a); return 'W' + Date.now().toString(36) + '-' + Array.prototype.map.call(a,function(b){return ('0'+b.toString(16)).slice(-2);}).join(''); }
$('#btnEditar').addEventListener('click', function(){ irPaso(1); });

/* --- confirmar: un solo viaje (rid, botón ocupado, reintento solo de red) --- */
var btnEnv = $('#btnEnviar');
btnEnv.addEventListener('click', function(){
  if(estado.enviando) return;
  if(!self.EP_API){ $('#msgEnvio').className='msg msg--gen'; $('#msgEnvio').textContent='El generador se está activando. Escríbame por WhatsApp y le envío la propuesta.'; return; }
  estado.enviando = true; btnEnv.setAttribute('aria-busy','true'); btnEnv.querySelector('span').textContent = 'Generando';
  var cuerpo = JSON.stringify({r:'propuesta', rid:estado.rid, candidato:estado.datos.candidato, departamento:estado.datos.departamento,
    municipio:estado.datos.municipio, correos:estado.datos.correos, hp:$('#fHp').value, tp:MED.carga||0});
  var t0 = performance.now();
  enviar(cuerpo, 0).then(function(r){
    var ms = Math.round(performance.now()-t0);
    try{ console.info('[EP] propuesta: ida y vuelta '+ms+' ms · servidor '+(r.ms||'?')+' ms · v'+(r.v||'')); }catch(e){}
    if(r.ok){
      // procesar la cola de fondo (PDF + correo) sin hacer esperar al usuario
      try{ fetch(self.EP_API + '?r=cola', {mode:'no-cors', keepalive:true}).catch(function(){}); }catch(e){}
      $('#finTxt').textContent = 'En unos minutos llega el PDF a ' + estado.datos.correos[0] + (estado.datos.correos.length>1 ? ' (y a las copias)' : '') + '. Revise también la carpeta de spam o promociones.';
      $('#finId').textContent = 'Solicitud ' + r.id;
      $('#finWa').href = 'https://wa.me/573103230712?text=' + encodeURIComponent('Hola Oscar, generé la propuesta del Ecosistema Político para ' + estado.datos.municipio + ' (' + r.id + ') y quiero agendar la demostración.');
      estado.rid = ''; form.reset(); estado.dep = ''; estado.mun = ''; fMun.disabled = true; copias.innerHTML=''; btnCopia.hidden=false;
      $$('.campo', form).forEach(function(c){ c.classList.remove('bien','mal'); }); $$('.msg', form).forEach(function(m){ m.textContent=''; });
      $$('.estado-c', form).forEach(function(d){ d.className='estado-c'; });
      irPaso(3);
    }else{
      $('#msgEnvio').className = 'msg msg--gen'; $('#msgEnvio').textContent = r.error || 'No se pudo generar. Intente de nuevo.';
      if(r.campo){ irPaso(1); }
    }
  }).catch(function(){
    $('#msgEnvio').className = 'msg msg--gen';
    $('#msgEnvio').textContent = 'No hay conexión con el servidor. Revise su internet e intente de nuevo; no se enviará dos veces.';
  }).then(function(){
    estado.enviando = false; btnEnv.removeAttribute('aria-busy'); btnEnv.querySelector('span').textContent = 'Confirmar y generar';
  });
});
function enviar(cuerpo, intento){
  var ctl = new AbortController(), t = setTimeout(function(){ ctl.abort(); }, 30000);
  return fetch(self.EP_API, {method:'POST', body:cuerpo, signal:ctl.signal, redirect:'follow'})
    .then(function(r){
      clearTimeout(t);
      if(r.status===404 && intento < 2) return espera(800*(intento+1)).then(function(){ return enviar(cuerpo, intento+1); }); // eco 404 de Google
      if(!r.ok) throw new Error('http '+r.status);
      return r.json();
    }, function(err){
      clearTimeout(t);
      if(intento < 2) return espera(900*(intento+1)).then(function(){ return enviar(cuerpo, intento+1); });            // falla de red: mismo rid
      throw err;
    });
}
function espera(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

marca('js');
})();
