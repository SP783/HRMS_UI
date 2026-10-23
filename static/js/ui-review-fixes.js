(function(){
  function emailFields(){
    document.querySelectorAll('[data-email-provider]').forEach(function(select){
      const graph=select.value==='microsoft_graph';
      select.closest('form').querySelectorAll('[data-email-fields]').forEach(function(group){
        group.hidden=group.dataset.emailFields==='graph'?!graph:graph;
      });
    });
  }
  function navigationState(){
    document.querySelectorAll('[data-cu-navigation-toggle]').forEach(function(button){
      const navigation=button.closest('.cu-navigation');
      const expanded=window.matchMedia('(max-width:850px)').matches?
        navigation.classList.contains('is-open'):!navigation.closest('.cu-workspace').classList.contains('cu-workspace-nav-collapsed');
      button.setAttribute('aria-expanded',String(expanded));
    });
  }
  document.addEventListener('change',function(event){if(event.target.matches('[data-email-provider]'))emailFields();});
  document.addEventListener('click',function(event){
    const button=event.target.closest('[data-cu-navigation-toggle]');
    if(!button)return;
    const navigation=button.closest('.cu-navigation');
    let expanded;
    if(window.matchMedia('(max-width:850px)').matches){expanded=navigation.classList.toggle('is-open');}
    else{expanded=!navigation.closest('.cu-workspace').classList.toggle('cu-workspace-nav-collapsed');}
    button.setAttribute('aria-expanded',String(expanded));
  });
  document.addEventListener('DOMContentLoaded',function(){emailFields();navigationState();});
  window.matchMedia('(max-width:850px)').addEventListener('change',navigationState);
  document.addEventListener('htmx:afterSwap',emailFields);
})();
