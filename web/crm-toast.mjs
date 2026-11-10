// Success toast at the top centre of the screen. Click closes it early; close(true) removes it silently (screen disposed).
export function showToast({text,sub,ms=3000,onClose=()=>{}}){
 const toast=document.createElement('div');toast.className='crm-toast';toast.setAttribute('role','status');
 const strong=document.createElement('strong');strong.textContent=text;toast.append(strong);
 if(sub){const span=document.createElement('span');span.textContent=sub;toast.append(span);}
 let timer=0,closed=false;
 function close(silent=false){if(closed)return;closed=true;clearTimeout(timer);toast.remove();if(!silent)onClose();}
 toast.addEventListener('click',()=>close());timer=setTimeout(()=>close(),ms);document.body.append(toast);
 return {close};
}
