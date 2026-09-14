// Frontend enhanced (Vanilla JS)
// No secrets here — frontend talks to /api only.

const API_BASE = '/api';
const postsContainer = document.getElementById('posts');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const refreshBtn = document.getElementById('refreshBtn');
const statusBar = document.getElementById('statusBar');
const searchInput = document.getElementById('searchInput');
const fromDateInput = document.getElementById('fromDate');
const toDateInput = document.getElementById('toDate');
const themeToggle = document.getElementById('themeToggle');
const clearSearchBtn = document.getElementById('clearSearch');
const totalInfo = document.getElementById('totalInfo');

const lightbox = document.getElementById('lightbox');
const lightboxInner = document.getElementById('lightboxInner');
const lightboxCaption = document.getElementById('lightboxCaption');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxBackdrop = document.getElementById('lightboxBackdrop');

let page = 1;
const LIMIT = 9;
let loading = false;
let finished = false;
let lastTotal = 0;
const cacheKey = 'telegram_posts_cache_v2';

// IntersectionObserver for lazy media loading
const ioOptions = {root: null, rootMargin: '200px', threshold: 0.01};
const mediaObserver = new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      const el = entry.target;
      const src = el.dataset.src;
      if(!src) { mediaObserver.unobserve(el); return; }
      // set src for images or videos
      if(el.tagName === 'IMG'){
        el.src = src;
        el.loading = 'lazy';
        el.removeAttribute('data-src');
      } else if(el.tagName === 'VIDEO'){
        el.src = src;
        el.preload = 'metadata';
        el.removeAttribute('data-src');
      }
      mediaObserver.unobserve(el);
    }
  });
}, ioOptions);

function setStatus(text, busy=false){
  statusBar.textContent = text;
  statusBar.setAttribute('aria-busy', busy ? 'true' : 'false');
  if(busy){
    statusBar.classList.add('working');
  } else {
    statusBar.classList.remove('working');
  }
}

function formatDate(ts){
  try{
    const d = new Date(ts);
    return new Intl.DateTimeFormat('ar-EG', {dateStyle:'medium', timeStyle:'short'}).format(d);
  }catch(e){
    return new Date(ts).toLocaleString();
  }
}

function createPostCard(post){
  const tpl = document.getElementById('postTemplate');
  const el = tpl.content.cloneNode(true);
  const card = el.querySelector('.post-card');
  const dateEl = el.querySelector('.post-date');
  const textEl = el.querySelector('.post-text');
  const mediaEl = el.querySelector('.post-media');
  const openLink = el.querySelector('.openTelegram');
  const postIdEl = el.querySelector('.post-id');

  dateEl.textContent = formatDate(post.date);
  dateEl.title = new Date(post.date).toISOString();
  textEl.textContent = post.text || (post.caption || '') || '';
  postIdEl.textContent = `${post.message_id || ''}`;

  if(post.permalink){
    openLink.href = post.permalink;
    openLink.removeAttribute('aria-disabled');
  } else {
    openLink.href = '#';
    openLink.setAttribute('aria-disabled','true');
    openLink.addEventListener('click', (e)=>e.preventDefault());
  }

  // media items
  if(post.media && post.media.length){
    post.media.forEach(m=>{
      if(m.type === 'photo'){
        const img = document.createElement('img');
        img.alt = textEl.textContent ? textEl.textContent.slice(0,80) : 'صورة';
        img.dataset.src = m.url; // lazy
        img.className = 'media-thumb';
        img.addEventListener('click', ()=>openLightbox('image', m.url, textEl.textContent));
        mediaEl.appendChild(img);
        mediaObserver.observe(img);
      } else if(m.type === 'video'){
        const vid = document.createElement('video');
        vid.controls = true;
        vid.dataset.src = m.url; // lazy load
        vid.preload = 'metadata';
        vid.className = 'media-thumb';
        vid.addEventListener('click', ()=>openLightbox('video', m.url, textEl.textContent));
        mediaEl.appendChild(vid);
        mediaObserver.observe(vid);
      } else if(m.type === 'document'){
        const a = document.createElement('a');
        a.href = m.url;
        a.textContent = m.file_name || 'ملف';
        a.target = '_blank';
        mediaEl.appendChild(a);
      }
    });
  }

  return el;
}

function renderSkeleton(count = 6){
  postsContainer.innerHTML = '';
  for(let i=0;i<count;i++){
    const s = document.createElement('div');
    s.className = 'skeleton';
    s.innerHTML = `
      <div class="skel-line" style="width:50%"></div>
      <div class="skel-row">
        <div style="flex:1">
          <div class="skel-line skel-big" style="width:100%"></div>
          <div class="skel-line" style="width:90%;margin-top:8px"></div>
          <div class="skel-line" style="width:70%;margin-top:8px"></div>
        </div>
      </div>
    `;
    postsContainer.appendChild(s);
  }
}

async function fetchPosts(opts = {}, append=true){
  if(loading) return;
  loading = true;
  setStatus('جلب المنشورات...', true);
  postsContainer.setAttribute('aria-busy','true');

  if(!append){
    renderSkeleton(6);
  }

  const q = new URLSearchParams();
  q.set('page', opts.page || page);
  q.set('limit', opts.limit || LIMIT);
  if(opts.search) q.set('search', opts.search);
  if(opts.from) q.set('from', opts.from);
  if(opts.to) q.set('to', opts.to);

  try {
    const res = await fetch(`${API_BASE}/posts?${q.toString()}`, {cache:'no-store'});
    if(!res.ok) throw new Error(`خطأ من الخادم: ${res.status}`);
    const data = await res.json();

    // update UI
    if(!append) postsContainer.innerHTML = '';

    if(data && Array.isArray(data.items)){
      if(data.items.length === 0 && page === 1){
        setStatus('لا توجد منشورات لعرضها.');
        postsContainer.innerHTML = '<div class="status">لا توجد نتائج.</div>';
        loadMoreBtn.style.display = 'none';
      } else {
        data.items.forEach(p=>{
          const node = createPostCard(p);
          postsContainer.appendChild(node);
        });
        setStatus(`تم عرض ${data.items.length} منشور${data.items.length>1?'ات':''}.`);
        loadMoreBtn.style.display = (data.items.length < LIMIT) ? 'none' : '';
      }
      lastTotal = data.total || lastTotal;
      totalInfo.textContent = `${lastTotal} منشور${lastTotal>1?'ات':''}`;
      // update cache
      try{ localStorage.setItem(cacheKey, JSON.stringify({items:data.items, ts:Date.now()})); }catch(e){}
    } else {
      setStatus('لم يتم تلقي منشورات من الخادم.');
    }

  } catch(err){
    console.error(err);
    setStatus('حدث خطأ أثناء جلب المنشورات.');
    // try show cache if available
    showCachedIfAny();
  } finally {
    loading = false;
    postsContainer.setAttribute('aria-busy','false');
  }
}

function loadMore(){
  if(finished || loading) return;
  page += 1;
  loadMoreBtn.disabled = true;
  loadMoreBtn.textContent = 'تحميل...';
  fetchPosts({page, limit:LIMIT, search:searchInput.value.trim(), from:fromDateInput.value, to:toDateInput.value}, true)
    .finally(()=>{ loadMoreBtn.disabled = false; loadMoreBtn.textContent = 'تحميل المزيد'; });
}

function showCachedIfAny(){
  try{
    const raw = localStorage.getItem(cacheKey);
    if(!raw) return;
    const parsed = JSON.parse(raw);
    if(parsed && parsed.items){
      postsContainer.innerHTML = '';
      parsed.items.forEach(p=>{
        postsContainer.appendChild(createPostCard(p));
      });
      setStatus('عرض من التخزين المحلي (قديم).');
    }
  }catch(e){ console.warn('no cache', e)}
}

function debounce(fn, wait=350){
  let t;
  return (...a)=>{ clearTimeout(t); t = setTimeout(()=>fn(...a), wait); };
}

searchInput.addEventListener('input', debounce(()=>{
  page = 1;
  finished = false;
  fetchPosts({page:1, limit:LIMIT, search:searchInput.value.trim(), from:fromDateInput.value, to:toDateInput.value}, false);
}, 450));

clearSearchBtn.addEventListener('click', ()=>{
  searchInput.value = '';
  searchInput.focus();
  page = 1; finished = false;
  fetchPosts({page:1, limit:LIMIT}, false);
});

fromDateInput.addEventListener('change', ()=>{
  page =1; finished=false;
  fetchPosts({page:1, limit:LIMIT, search:searchInput.value.trim(), from:fromDateInput.value, to:toDateInput.value}, false);
});
toDateInput.addEventListener('change', ()=>{
  page =1; finished=false;
  fetchPosts({page:1, limit:LIMIT, search:searchInput.value.trim(), from:fromDateInput.value, to:toDateInput.value}, false);
});

loadMoreBtn.addEventListener('click', loadMore);
refreshBtn.addEventListener('click', async ()=>{
  setStatus('جاري طلب تحديث من الخادم...', true);
  try{
    const r = await fetch(`${API_BASE}/refresh`, {method:'POST'});
    const j = await r.json();
    setStatus(j.message || 'تم الطلب.');
    // reload
    page = 1; finished=false; postsContainer.innerHTML='';
    fetchPosts({page:1, limit:LIMIT, search:searchInput.value.trim(), from:fromDateInput.value, to:toDateInput.value}, false);
  }catch(e){
    console.error(e); setStatus('تعذر إرسال طلب التحديث.');
  }
});

// theme handling
function applyTheme(theme){
  if(theme === 'light') document.documentElement.setAttribute('data-theme','light');
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('theme', theme);
  themeToggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  themeToggle.querySelector('.icon').textContent = theme === 'dark' ? '☀️' : '🌙';
}
themeToggle.addEventListener('click', ()=>{
  const cur = localStorage.getItem('theme') === 'dark' ? 'light' : 'dark';
  applyTheme(cur);
});

// Lightbox logic
function openLightbox(type, url, caption){
  lightboxInner.innerHTML = '';
  lightboxCaption.textContent = caption || '';
  if(type === 'image'){
    const img = document.createElement('img');
    img.src = url;
    img.alt = caption || 'صورة';
    lightboxInner.appendChild(img);
  } else if(type === 'video'){
    const v = document.createElement('video');
    v.src = url;
    v.controls = true;
    v.autoplay = true;
    lightboxInner.appendChild(v);
  }
  lightbox.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
}
function closeLightbox(){
  lightbox.setAttribute('aria-hidden','true');
  lightboxInner.innerHTML = '';
  document.body.style.overflow = '';
}
lightboxClose.addEventListener('click', closeLightbox);
lightboxBackdrop.addEventListener('click', closeLightbox);
document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeLightbox(); });

// initial: try show cached
(function init(){
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
  showCachedIfAny();
  // initial fetch
  page = 1;
  fetchPosts({page:1, limit:LIMIT}, false);
})();
