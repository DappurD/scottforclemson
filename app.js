(() => {
  'use strict';
  const config = window.CAMPAIGN_CONFIG || {preview:true};
  const root = document.documentElement;
  const mq = q => (window.matchMedia ? window.matchMedia(q) : {matches:false, addEventListener(){}});
  const onChange = (list, fn) => { if(list.addEventListener) list.addEventListener('change', fn); else if(list.addListener) list.addListener(fn); };
  const reduceMotion = mq('(prefers-reduced-motion: reduce)').matches;

  /* ---- Preview labeling: concept-only notes disappear when config.preview is false (all pages), and html.is-live
     lets CSS drop what must never ship empty (the photo slots that still have no photo) */
  if(!config.preview){
    document.querySelectorAll('.preview-only').forEach(el => { el.hidden = true; });
    root.classList.add('is-live');
  }

  /* ---- UI: phone menu sheet (aria-expanded, focus trap, Escape, scrim, inert background) */
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#nav');
  if(menu && nav){
    const bar = menu.closest('.site-header__bar');
    const background = () => document.querySelectorAll('body > main, body > footer, body > .preview-note, body > .skip-link');
    // The Tab cycle holds every control the open sheet leaves visible and active, in screen order: the bar's
    // wordmark, its Get Involved pill and Menu, then the sheet's links (hidden ones have no client rects)
    const items = () => (bar ? [...bar.querySelectorAll('a[href], button:not([disabled])')] : [menu, ...nav.querySelectorAll('a[href], button:not([disabled])')]).filter(el => el === menu || el.getClientRects().length);
    let open = false;
    // The sheet ends just above the bottom of the screen wherever it starts: lower while the preview notice
    // above the header is still on screen (the page cannot scroll while the sheet is open). CSS reads --sheet-top.
    const fit = () => { if(bar) nav.style.setProperty('--sheet-top', Math.round(bar.getBoundingClientRect().top + bar.clientTop + nav.offsetTop) + 'px'); };
    // Keep a focused sheet item, ring included, inside the sheet's own scroll area (the page itself stays still)
    const reveal = el => {
      if(!nav.contains(el)) return;
      const r = el.getBoundingClientRect(), n = nav.getBoundingClientRect(), ring = 6;
      const top = n.top + nav.clientTop, bottom = top + nav.clientHeight;
      if(r.top - ring < top) nav.scrollTop -= top - (r.top - ring);
      else if(r.bottom + ring > bottom) nav.scrollTop += Math.min(r.bottom + ring - bottom, r.top - ring - top);
    };
    const setOpen = (next, returnFocus) => {
      if(next === open) return;
      open = next;
      menu.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      root.classList.toggle('menu-open', open);
      background().forEach(el => { if(open) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
      if(open){ fit(); const first = nav.querySelector('a[href]'); if(first) first.focus({preventScroll:true}); }
      else { nav.style.removeProperty('--sheet-top'); if(returnFocus) menu.focus({preventScroll:true}); }
    };
    menu.addEventListener('click', () => setOpen(!open, true));
    window.addEventListener('resize', () => { if(open) fit(); }, {passive:true});
    // Choosing a destination closes the sheet: its links, and the bar's wordmark and Get Involved pill. In-page
    // links move focus to their target (below); any other link (the phone number) returns focus to Menu, since
    // the link itself disappears with the sheet.
    (bar || nav).querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false, (a.getAttribute('href') || '').charAt(0) !== '#')));
    document.addEventListener('keydown', e => {
      if(!open) return;
      if(e.key === 'Escape'){ e.preventDefault(); setOpen(false, true); return; }
      if(e.key === 'Tab'){
        // Move focus ourselves (without scrolling): focusing the sticky Menu button natively would
        // scroll the page behind the sheet, because it sits inside the scroll-padding area.
        e.preventDefault();
        const list = items(), i = list.indexOf(document.activeElement);
        const next = i < 0 ? list[0] : list[(i + (e.shiftKey ? -1 : 1) + list.length) % list.length];
        next.focus({preventScroll:true});
        reveal(next);
      }
    });
    document.addEventListener('click', e => { if(open && bar && !bar.contains(e.target)) setOpen(false, true); });
    const desktop = mq('(min-width: 1000px)');
    onChange(desktop, () => { if(desktop.matches) setOpen(false, false); });
  }

  /* ---- UI: smooth scrolling for in-page links (instant for reduced motion); focus the target.
     A section is scrolled to its running head, so the reader lands on content rather than on the
     section's top padding (without JS the browser jumps to the section itself). */
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if(!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const id = a.getAttribute('href').slice(1), target = id && document.getElementById(id);
    if(!target) return;
    e.preventDefault();
    const landing = (target.matches('.section, .section-panel') && target.querySelector('.section-label')) || target;
    landing.scrollIntoView({behavior: reduceMotion ? 'auto' : 'smooth', block: 'start'});
    if(history.pushState) history.pushState(null, '', '#' + id);
    if(!target.matches('a,button,input,select,textarea,[tabindex]')) target.setAttribute('tabindex', '-1');
    target.focus({preventScroll:true});
  });

  /* ---- UI: header scroll state ------------------------------------------ */
  const header = document.querySelector('[data-header]');
  const scrollJobs = [];
  if(header) scrollJobs.push(() => header.classList.toggle('is-scrolled', window.scrollY > 8));

  /* ---- UI: the header pill takes the surface under it. Each dark or light region carries data-surface;
     the last one (in document order) that contains the pill's midline wins, so a dark panel nested in the
     cream canvas counts. Nothing under the pill (the page top, above the first region) keeps the first
     region's surface: light on the home page (the sign), dark on the subpages (their dark page hero). */
  const surfaces = header ? [...document.querySelectorAll('[data-surface]')].filter(el => el !== header) : [];
  if(header && surfaces.length){
    const bar = header.querySelector('.site-header__bar') || header;
    const topSurface = surfaces[0].getAttribute('data-surface') || 'dark';
    let currentSurface = header.getAttribute('data-surface');
    scrollJobs.push(() => {
      const r = bar.getBoundingClientRect(), y = r.top + r.height / 2;
      let found = topSurface;
      surfaces.forEach(el => { const b = el.getBoundingClientRect(); if(b.top <= y && b.bottom > y) found = el.getAttribute('data-surface') || found; });
      if(found !== currentSurface){ currentSurface = found; header.setAttribute('data-surface', found); }
    });
    window.addEventListener('resize', () => scrollJobs.forEach(fn => fn()), {passive:true});
  }

  /* ---- UI: active-section indicator in the navigation (links and the Get Involved button).
     The current section is the last one whose top has passed 40% of the viewport, so the
     "Our City. Our Council." band keeps Priorities marked and the footer keeps Get Involved.
     onActive runs only when the current section changes (the sliding marker below hooks in). */
  const navLinks = [...document.querySelectorAll('.site-nav a[href^="#"]')];
  const spySections = ['meet', 'priorities', 'vote', 'join'].map(id => document.getElementById(id)).filter(Boolean);
  let onActive = () => {};
  if(navLinks.length && spySections.length){
    let currentId;
    const spy = () => {
      const line = window.innerHeight * 0.4;
      let current = null;
      spySections.forEach(sec => { if(sec.getBoundingClientRect().top <= line) current = sec; });
      const id = current ? current.id : '';
      if(id === currentId) return;
      currentId = id;
      navLinks.forEach(a => {
        const on = !!id && a.getAttribute('href') === '#' + id;
        a.classList.toggle('is-active', on);
        if(on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
      onActive();
    };
    scrollJobs.push(spy);
    window.addEventListener('resize', spy, {passive:true});
  }

  /* ---- UI: the sliding marker behind the current desktop navigation link (CSS transitions its
     transform and width; under reduced motion the transition is off and the marker simply moves).
     It is measured only when the current section changes, on resize and once the fonts are in,
     never on every scroll frame. */
  const rail = document.querySelector('.site-nav__rail');
  if(rail && navLinks.length){
    const place = () => {
      const on = navLinks.find(a => a.classList.contains('is-active'));
      if(!on || !on.getClientRects().length || getComputedStyle(rail.querySelector('.site-nav__pill')).display === 'none'){ rail.classList.remove('has-active'); return; }
      const r = on.getBoundingClientRect(), b = rail.getBoundingClientRect();
      rail.style.setProperty('--pill-x', Math.round(r.left - b.left) + 'px');
      rail.style.setProperty('--pill-w', Math.round(r.width) + 'px');
      rail.classList.add('has-active');
    };
    onActive = place;
    window.addEventListener('resize', place, {passive:true});
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  }

  /* ---- UI: priorities glow that follows the cursor (fine pointers only; off under reduced motion).
     Only the glow disc's transform changes, so the pillar itself is never repainted. */
  const pillars = [...document.querySelectorAll('.pillar')];
  if(pillars.length && !reduceMotion && mq('(hover: hover) and (pointer: fine)').matches){
    pillars.forEach(p => {
      let x = 0, y = 0, queued = false;
      const paint = () => { queued = false; p.style.setProperty('--gx', x + 'px'); p.style.setProperty('--gy', y + 'px'); };
      p.classList.add('has-glow');
      p.addEventListener('pointermove', e => {
        const r = p.getBoundingClientRect();
        x = Math.round(e.clientX - r.left); y = Math.round(e.clientY - r.top);
        if(!queued){ queued = true; requestAnimationFrame(paint); }
      }, {passive:true});
    });
  }

  /* ---- UI: on narrow screens the empty photo shelf is one row that scrolls sideways (CSS). While it actually
     scrolls it is a named, focusable group (not a landmark: it only holds placeholder frames), so the keyboard can
     scroll it too; otherwise it is a plain grid. */
  const shelf = document.querySelector('.gallery__grid');
  if(shelf && 'ResizeObserver' in window){
    new ResizeObserver(() => {
      const scrolls = shelf.scrollWidth > shelf.clientWidth + 1;
      if(scrolls === shelf.hasAttribute('tabindex')) return;
      if(scrolls){ shelf.tabIndex = 0; shelf.setAttribute('role', 'group'); shelf.setAttribute('aria-label', 'Photo shelf'); }
      else ['tabindex', 'role', 'aria-label'].forEach(a => shelf.removeAttribute(a));
    }).observe(shelf);
  }

  /* ---- Motion: once the load entrance has played (the last cover fact ends at 1.6s), .is-settled drops the entrance
     animations (their end state is the resting style), so rotating a tablet, resizing across a breakpoint, printing
     or a full-page capture never replays them from opacity 0 */
  const settle = () => setTimeout(() => root.classList.add('is-settled'), 1800);
  if(document.readyState === 'complete') settle(); else window.addEventListener('load', settle, {once:true});

  /* ---- UI: gentle reveal on scroll (content stays visible without JS or with reduced motion) */
  const reveals = [...document.querySelectorAll('[data-reveal]')];
  if(!reduceMotion && 'IntersectionObserver' in window && reveals.length){
    reveals.forEach(el => { const r = el.getBoundingClientRect(); if(r.top < window.innerHeight && r.bottom > 0) el.classList.add('is-in'); });
    root.classList.add('motion');
    const show = new IntersectionObserver(entries => entries.forEach(en => {
      if(en.isIntersecting){ en.target.classList.add('is-in'); show.unobserve(en.target); }
    }), {rootMargin: '0px 0px -6% 0px', threshold: 0.01});
    reveals.forEach(el => { if(!el.classList.contains('is-in')) show.observe(el); });
    window.addEventListener('beforeprint', () => reveals.forEach(el => el.classList.add('is-in')));
  }

  if(scrollJobs.length){
    let ticking = false;
    const run = () => { ticking = false; scrollJobs.forEach(fn => fn()); };
    window.addEventListener('scroll', () => { if(!ticking){ ticking = true; requestAnimationFrame(run); } }, {passive:true});
    run();
  }

  /* ---- Signup form (payload and validation follow launch/form-contract.json) */
  const form=document.querySelector('#signup-form');
  if(!form)return;
  const fields=form.querySelector('fieldset'),error=document.querySelector('#form-error'),result=document.querySelector('#form-result'),button=document.querySelector('#submit-button');
  fields.disabled=false; // the form ships disabled, so it can never submit natively (contact details in a URL) without this script
  const startedAt=Date.now();
  const requestId=window.crypto?.randomUUID?.() || 'req-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  const submitLabel=config.preview?'Preview my signup':'Send my request';
  button.firstChild.textContent=submitLabel+' ';

  /* UI: "ways to help" tiles preselect the interest and move focus to the email field.
     Without JS they are plain jump links to the form. */
  const interest=document.querySelector('#interest');
  document.querySelectorAll('[data-interest]').forEach(link=>link.addEventListener('click',e=>{
    const value=link.getAttribute('data-interest');
    if(!interest || fields.hidden || ![...interest.options].some(o=>o.value===value))return;
    e.preventDefault();
    interest.value=value;
    interest.dispatchEvent(new Event('change',{bubbles:true}));
    if(!reduceMotion){interest.classList.remove('is-flash');void interest.offsetWidth;interest.classList.add('is-flash');}
    form.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'});
    document.querySelector('#email').focus({preventScroll:true});
  }));

  /* UI only: the phone keyboard's "next" key (enterkeyhint) moves to the next field instead of
     submitting the form; only the submit button sends it. */
  const order=['email','name','interest','phone','email-consent'];
  form.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||e.isComposing||e.shiftKey||e.altKey||e.ctrlKey||e.metaKey)return;
    const t=e.target,i=order.indexOf(t.id);
    if(i<0||i===order.length-1||!t.matches('input:not([type="checkbox"])'))return;
    e.preventDefault();document.getElementById(order[i+1]).focus();
  });

  /* UI only: mark the field a message refers to (aria-invalid + a visual note beside it).
     The message itself is still announced once, from #form-error (role="alert"), and is
     cleared once the field is corrected, so a fixed field no longer describes itself with it.
     Returns true when the note is shown, so the alert box need not repeat it on screen. */
  /* UI only: #form-error describes only the field(s) its message is about (both consent boxes for a consent
     message), so tabbing to another field does not read that message as the other field's own description.
     With no message, or one with no field, every field that lists it in the HTML is described by it again. */
  const described=[...form.querySelectorAll('[aria-describedby~="form-error"]')];
  const describe=targets=>described.forEach(f=>{
    const ids=(f.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!=='form-error');
    if(!targets||targets.includes(f))ids.push('form-error');
    if(ids.length)f.setAttribute('aria-describedby',ids.join(' '));else f.removeAttribute('aria-describedby');
  });
  const clearMarks=()=>{form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));form.querySelectorAll('.field-note').forEach(n=>n.remove());describe();};
  const mark=(message,el)=>{
    if(!el)return false;
    el.setAttribute('aria-invalid','true');
    const holder=el.closest('.field, .consent');
    const group=holder&&holder.classList.contains('consent')?holder.closest('.consents'):null;
    describe(group?[...group.querySelectorAll('input')]:[el]);
    if(!holder)return false;
    const note=document.createElement('p');note.className='field-note';note.setAttribute('aria-hidden','true');note.textContent=message;
    if(!group)holder.append(note);else group.querySelector('.consents__label').after(note); // a consent note sits above both choices
    const clear=()=>{el.removeAttribute('aria-invalid');note.remove();if(error.textContent===message){error.textContent='';describe();}};
    (group?[...group.querySelectorAll('input')]:[el]).forEach(w=>{w.addEventListener('input',clear,{once:true});w.addEventListener('change',clear,{once:true});});
    return true;
  };

  /* UI only: when the note beside the field shows the message, #form-error stays the role="alert" announcer
     (and the fields' description) but is hidden visually (.is-marked), so the sentence is not shown twice.
     A message with no field (such as "not connected") keeps the visible box above the button. */
  const fail=(message,el)=>{error.textContent=message;error.classList.toggle('is-marked',mark(message,el));if(el)el.focus();};
  form.addEventListener('submit',async e=>{
    e.preventDefault();error.textContent='';result.hidden=true;clearMarks();
    const fd=new FormData(form),phone=String(fd.get('phone')||'').trim(),digits=phone.replace(/\D/g,'');
    // Checks run in field order (email, phone, then the update choices), so the first message is the first field to fix.
    // The email rule matches the intake's own (launch/signup-worker.mjs validate()): a dot in the domain is required.
    const emailEl=document.querySelector('#email');
    if(!emailEl.validity.valid||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(fd.get('email')||'').trim()))return fail('Please enter a valid email address.',emailEl);
    if(phone && !(digits.length===10 || (digits.length===11 && digits.startsWith('1'))))return fail('Enter a 10-digit U.S. mobile number, or leave the phone blank.',document.querySelector('#phone'));
    if(fd.get('sms_consent')==='on'&&!phone)return fail('To get texts, add a mobile number, or uncheck the texts box.',document.querySelector('#phone'));
    if(fd.get('interest')==='updates' && fd.get('email_consent')!=='on' && fd.get('sms_consent')!=='on')return fail('To get campaign updates, check email or texts below.',document.querySelector('#email-consent'));
    const url=new URL(window.location.href),safeSource=v=>String(v||'').replace(/[^a-zA-Z0-9._-]/g,'').slice(0,80);
    const payload={request_id:requestId,name:String(fd.get('name')||'').trim(),email:String(fd.get('email')||'').trim().toLowerCase(),phone:phone?'+1'+digits.slice(-10):'',interest:String(fd.get('interest')),email_consent:fd.get('email_consent')==='on',sms_consent:fd.get('sms_consent')==='on',consent_version:config.consentVersion,consent_text:document.querySelector('#sms-consent-text').textContent,email_consent_text:document.querySelector('#email-consent-text').textContent,submitted_at:new Date().toISOString(),form_started_at:startedAt,website:String(fd.get('website')||''),source:{utm_source:safeSource(url.searchParams.get('utm_source')),utm_medium:safeSource(url.searchParams.get('utm_medium')),utm_campaign:safeSource(url.searchParams.get('utm_campaign')),utm_content:safeSource(url.searchParams.get('utm_content'))}};
    if(!config.preview&&!config.formEndpoint)return fail('Signup isn’t connected yet. Call us at 908-721-6664 instead.');
    button.disabled=true;
    try{
      if(!config.preview){
        const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
        let response;try{response=await fetch(config.formEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});}finally{clearTimeout(timeout);}
        if(!response.ok){
          // The intake names a rejected email address ({error:'Invalid email'}): mark and focus that field
          let reason='';try{reason=String((await response.json()).error||'');}catch{}
          if(response.status===400&&reason==='Invalid email')throw Object.assign(new Error('Please enter a valid email address.'),{field:emailEl});
          throw new Error('That didn’t go through. Try again, or call us at 908-721-6664.');
        }
        const data=await response.json();if(data.accepted!==true)throw new Error('We didn’t get a confirmation back. Please try again.');
      }
      fields.hidden=true;result.replaceChildren();
      const heading=document.createElement('h3');heading.textContent=config.preview?'Your signup preview':'Thank you';result.append(heading);
      const text=document.createElement('p');text.textContent=config.preview?'That’s the whole flow. Nothing was sent or saved. On the live site, this is where we confirm we got your request.':'Got it. We’ll follow up on your request. You’ll only get campaign updates by email or text if you checked those boxes.';result.append(text);
      const ul=document.createElement('ul');const labels={updates:'Campaign updates',volunteer:'Volunteering','yard-sign':'A yard sign',contact:'Talking with the campaign'}; // the form's own option text
      ['Interest: '+labels[payload.interest],'Email updates: '+(payload.email_consent?'Opted in':'Not selected'),'Text updates: '+(payload.sms_consent?'Opted in':'Not selected')].forEach(s=>{const li=document.createElement('li');const i=s.indexOf(': ');const k=document.createElement('span');k.className='form-result__key';k.textContent=s.slice(0,i+1);const v=document.createElement('span');v.className='form-result__value';v.textContent=' '+s.slice(i+2);li.append(k,v);ul.append(li);});result.append(ul);
      const link=document.createElement('a');link.href='#vote';link.className='link-arrow';
      const svgNS='http://www.w3.org/2000/svg',arrow=document.createElementNS(svgNS,'svg'),use=document.createElementNS(svgNS,'use');
      arrow.setAttribute('class','icon');arrow.setAttribute('aria-hidden','true');arrow.setAttribute('focusable','false');use.setAttribute('href','#i-arrow-r');arrow.append(use);
      const tail=document.createElement('span');tail.className='nowrap';tail.append('vote',arrow);
      link.append('Make a plan to ',tail);result.append(link);result.hidden=false;
      /* UI only: bring the panel's top (check badge and heading) into view below the sticky header.
         Focusing it alone scrolls a tall panel only far enough to show its bottom on short phones. */
      result.focus({preventScroll:true});result.scrollIntoView({block:'start',behavior:reduceMotion?'auto':'smooth'});
      window.dispatchEvent(new CustomEvent('campaign:signup_complete',{detail:{preview:config.preview,interest:payload.interest}}));
    }catch(err){
      // Only the messages this code writes itself (plain Errors) reach the visitor; a network failure (TypeError),
      // a response that is not JSON (SyntaxError) or anything else shows the campaign's general message
      fail(err.name==='AbortError'?'That timed out. Try again, or call us at 908-721-6664.':err.name==='Error'?err.message:'That didn’t go through. Try again, or call us at 908-721-6664.',err.field);
    }
    // Disabling the button while the request is out drops keyboard focus to the page; a failed request with no
    // field to fix returns it to the button, beside the message
    finally{button.disabled=false;if(document.activeElement===document.body||!document.activeElement)button.focus({preventScroll:true});}
  });
})();
