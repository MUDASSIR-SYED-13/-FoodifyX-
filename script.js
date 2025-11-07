/* script.js - CyberSnack Hub
   Single JS file to manage cart, offers, payment simulation, and tracking
*/

// ---------- Utilities ----------
function qs(id){ return document.getElementById(id); }
function formatRs(n){ return '₹' + Number(n).toFixed(2); }

// ---------- Cart in localStorage ----------
const CART_KEY = 'cybersnack_cart_v1';
const OFFER_KEY = 'cybersnack_offer';
const ORDER_KEY = 'cybersnack_order';

function loadCart(){
  const raw = localStorage.getItem(CART_KEY);
  return raw ? JSON.parse(raw) : [];
}
function saveCart(cart){
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCounts();
}
function clearCart(){ localStorage.removeItem(CART_KEY); updateCartCounts(); }

// add item (if exists increase qty)
function addToCart(name, price){
  const cart = loadCart();
  const idx = cart.findIndex(i=>i.name===name);
  if(idx>-1){ cart[idx].qty += 1; } else { cart.push({name,price,qty:1}); }
  saveCart(cart);
  toast(`${name} added to cart`);
  renderCartSide();
}

// update cart counts in nav
function updateCartCounts(){
  const cart = loadCart();
  const count = cart.reduce((s,i)=>s+i.qty,0);
  const els = ['cartCount','cartCountMenu','cartCountRest','cartCountOffers'];
  els.forEach(id=>{ const el = document.getElementById(id); if(el) el.innerText = count; });
}

// small floating toast
function toast(msg){
  const t = document.createElement('div'); t.className='toast'; t.innerText = msg;
  Object.assign(t.style,{position:'fixed',right:'20px',bottom:'20px',background:'#111',padding:'10px 14px',borderRadius:'8px',boxShadow:'0 8px 20px rgba(0,0,0,0.6)',color:'#fff',zIndex:9999});
  document.body.appendChild(t);
  setTimeout(()=>t.style.opacity=0,1500); setTimeout(()=>t.remove(),2200);
}

// ---------- Render small cart sidebar on menu page ----------
function renderCartSide(){
  const el = qs('cartList');
  if(!el) return;
  const cart = loadCart();
  el.innerHTML = '';
  cart.forEach(i=>{
    const li = document.createElement('li');
    li.innerText = `${i.name} x${i.qty} - ₹${i.price*i.qty}`;
    el.appendChild(li);
  });
  qs('cartTotal').innerText = 'Total: ' + formatRs(cart.reduce((s,i)=>s+i.price*i.qty,0));
}

// ---------- Cart page render ----------
function renderCartPage(){
  const body = qs('cartBody');
  if(!body) return;
  const cart = loadCart();
  body.innerHTML = '';
  if(cart.length===0){
    body.innerHTML = '<tr><td colspan="5">Your cart is empty.</td></tr>';
  } else {
    cart.forEach((it,idx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${it.name}</td>
                      <td>${formatRs(it.price)}</td>
                      <td><input type="number" min="1" value="${it.qty}" onchange="changeQty(${idx},this.value)"></td>
                      <td>${formatRs(it.qty*it.price)}</td>
                      <td><button onclick="removeItem(${idx})">Remove</button></td>`;
      body.appendChild(tr);
    });
  }
  updateSummary();
}

function changeQty(i,q){ q = Number(q); if(q<1) q=1; const cart=loadCart(); cart[i].qty=q; saveCart(cart); renderCartPage(); renderCartSide(); }
function removeItem(i){ const cart=loadCart(); cart.splice(i,1); saveCart(cart); renderCartPage(); renderCartSide(); }

// ---------- Offers ----------
const OFFERS = {
  'BURGER50': {type:'percent',target:'Burger',percent:50,max:150,desc:'50% off on Burgers up to ₹150'},
  'PIZZA2': {type:'bogo',target:'Pizza',desc:'Buy 1 Get 1 on pizzas'},
  'COFFEE100': {type:'flat',min:499,amount:100,desc:'₹100 off on orders above ₹499'}
};

function applyOffer(code){
  if(!code) { qs('offerMsg') && (qs('offerMsg').innerText='Please enter a code'); return; }
  code = code.trim().toUpperCase();
  if(!OFFERS[code]){ qs('offerMsg') && (qs('offerMsg').innerText='Invalid code'); return; }
  localStorage.setItem(OFFER_KEY, code);
  qs('offerMsg') && (qs('offerMsg').innerText = `Offer ${code} applied`);
  updateSummary();
}

function getOfferDiscount(subtotal){
  const code = localStorage.getItem(OFFER_KEY);
  if(!code) return 0;
  const offer = OFFERS[code];
  if(!offer) return 0;
  const cart = loadCart();
  let discount = 0;
  if(offer.type==='percent'){
    // apply percent to items containing target (case-insensitive)
    cart.forEach(i=>{
      if(i.name.toLowerCase().includes(offer.target.toLowerCase())){
        discount += (i.price*i.qty) * (offer.percent/100);
      }
    });
    if(offer.max) discount = Math.min(discount, offer.max);
  } else if(offer.type==='bogo'){
    // count pizzas
    const pizzaItems = cart.filter(i=>i.name.toLowerCase().includes('pizza'));
    if(pizzaItems.length>0){
      // simple: give free cheapest single pizza in cart
      let cheapest = Infinity; pizzaItems.forEach(i=>{ cheapest = Math.min(cheapest, i.price); });
      discount = cheapest;
    }
  } else if(offer.type==='flat'){
    if(subtotal >= offer.min) discount = offer.amount;
  }
  return Math.round(discount);
}

// ---------- Summary update ----------
function updateSummary(){
  const subtotalEl = qs('subTotal');
  const offerEl = qs('offerApplied');
  const totalEl = qs('grandTotal');
  const cart = loadCart();
  const subtotal = cart.reduce((s,i)=>s + i.price*i.qty,0);
  const discount = getOfferDiscount(subtotal);
  const grand = Math.max(0, subtotal - discount);
  if(subtotalEl) subtotalEl.innerText = `Subtotal: ${formatRs(subtotal)}`;
  if(offerEl) offerEl.innerText = `Offer: -${formatRs(discount)}`;
  if(totalEl) totalEl.innerText = `Total: ${formatRs(grand)}`;
  // small messages
  qs('cartMsg') && (qs('cartMsg').innerText = cart.length ? '' : 'Your cart is empty.');
  qs('cartTotal') && (qs('cartTotal').innerText = `Total: ${formatRs(subtotal)}`);
  updateCartCounts();
}

// goToPayment - ensure cart not empty
function goToPayment(){
  const cart = loadCart(); if(cart.length===0){ alert('Your cart is empty'); return false; }
  // save current summary in localStorage for payment page
  const subtotal = cart.reduce((s,i)=>s + i.price*i.qty,0);
  const discount = getOfferDiscount(subtotal);
  const grand = Math.max(0, subtotal - discount);
  localStorage.setItem('payment_info', JSON.stringify({subtotal,discount,grand}));
  return true;
}

// ---------- Payment simulation ----------
function simulatePayment(method){
  const loader = qs('paymentLoader'); const msg = qs('paymentMsg');
  loader.classList.remove('hidden'); msg && (msg.innerText = `Processing ${method}...`);
  setTimeout(()=>{
    loader.classList.add('hidden');
    // generate order id & store order (simple)
    const orderId = 'CS' + Date.now();
    const payment_info = JSON.parse(localStorage.getItem('payment_info') || '{}');
    const order = { id: orderId, amount: payment_info ? payment_info.grand : 0, time: Date.now(), status: 'placed' };
    localStorage.setItem(ORDER_KEY, JSON.stringify(order));
    // clear cart
    clearCart();
    // redirect to success
    window.location.href = 'success.html';
  }, 3000);
}

// ---------- Success page load ----------
function loadSuccess(){
  const order = JSON.parse(localStorage.getItem(ORDER_KEY) || 'null');
  if(order){
    const el = qs('orderInfo'); if(el) el.innerText = `Order ID: ${order.id} • Amount: ${formatRs(order.amount)}`;
  }
}

// ---------- Tracker ----------
let trackInterval=null;
function startTracking(){
  const order = JSON.parse(localStorage.getItem(ORDER_KEY) || 'null');
  if(!order){ qs('trackMsg') && (qs('trackMsg').innerText = 'No active order'); return; }
  qs('trackMsg') && (qs('trackMsg').innerText = `Order ID: ${order.id}`);
  const stages = ['stage1','stage2','stage3','stage4'];
  let i = 0;
  // reset classes
  stages.forEach(s=>{ const el=qs(s); el && el.classList.remove('active'); });
  trackInterval = setInterval(()=>{
    if(i < stages.length){
      const el = qs(stages[i]); if(el) el.classList.add('active');
      i++;
    } else {
      clearInterval(trackInterval);
      // final status update in stored order
      const o = JSON.parse(localStorage.getItem(ORDER_KEY) || 'null'); if(o){ o.status='delivered'; localStorage.setItem(ORDER_KEY, JSON.stringify(o)); }
    }
  }, 2000);
}

// ---------- Page initialization ----------
document.addEventListener('DOMContentLoaded', ()=> {
  updateCartCounts();
  renderCartSide();
  renderCartPage();
  updateSummary();
  loadSuccess();
  // login form
  const loginForm = qs('loginForm');
  if(loginForm){
    loginForm.addEventListener('submit', (e)=>{
      e.preventDefault();
      const username = qs('username').value || 'guest';
      localStorage.setItem('cybersnack_user', username);
      window.location.href = 'menu.html';
    });
  }
  // if on track page start tracking
  if(document.querySelector('.track-container')) startTracking();
});

// ---------- Expose certain functions to global (so inline HTML can call them) ----------
window.addToCart = addToCart;
window.simulatePayment = simulatePayment;
window.applyOffer = applyOffer;
window.goToPayment = goToPayment;
window.loadSuccess = loadSuccess;
window.startTracking = startTracking;
window.changeQty = changeQty;
window.removeItem = removeItem;
