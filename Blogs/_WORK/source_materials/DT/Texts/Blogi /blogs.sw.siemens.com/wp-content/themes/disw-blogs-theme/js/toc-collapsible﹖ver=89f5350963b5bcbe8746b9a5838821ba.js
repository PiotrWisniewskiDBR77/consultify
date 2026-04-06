// mobile-TOC open and close feature

window.onscroll = function() {

    var mobile_toc = document.querySelector(".toc-for-mobile") ;
    var mobile_toc_height = mobile_toc.offsetHeight;
    var wrapper_nav = document.querySelector('#main-nav').offsetTop;
    var wrapper_nav_top = document.querySelector('#main-nav').offsetHeight;
    var article_header = document.querySelector('#article-header').clientHeight;

    // remove toc content after post-additional-content element

    var post_additional_content = document.querySelector('.post-additional-content').offsetTop - wrapper_nav - wrapper_nav_top - mobile_toc_height;
    const headings = document.querySelectorAll('.entry-content h1, .entry-content h2, .entry-content h3');

    if( window.scrollY >= post_additional_content){
        mobile_toc.style.display = "none";
        document.querySelector('.list_of_toc').style.display="none";
    } else {
        
        if (headings && headings.length >= 3) {
            mobile_toc.style.display = "block";
            document.querySelector('.list_of_toc').style.display="block";
        }
    }
  
    if(window.scrollY  >= article_header ) {
        mobile_toc.classList.add('mobile_toc_active');
        document.querySelector('.toc-for-mobile').style.position = "fixed";
        document.querySelector('.toc-for-mobile').style.top = wrapper_nav_top + wrapper_nav - 6 + "px";   
    }
    else if(window.scrollY <= article_header)  {
        mobile_toc.classList.add('mobile_toc_active');

        document.querySelector('.toc-for-mobile').style.position = "relative";
        document.querySelector('.toc-for-mobile').style.top = 0;
    }
}
function mobileTocDropdown(){
    // document.getElementById('arrow-on-click').addEventListener('click', function (e) {
        var open_toc = document.querySelector('.entry-sidebar');
        var mobile_toc = document.querySelector("#mobile-toc") ;
        var wrapper_nav = document.querySelector('#main-nav').offsetHeight;
        var wrapper_nav_top = document.querySelector('#main-nav').offsetTop;
    
        if(open_toc.style.display == "block"){
            open_toc.classList.remove('entry-sidebar-active');
            open_toc.style.display = "none";

        }
    
        else {
            document.querySelector('.toc-for-mobile').classList.add('mobile_toc_active');
            document.querySelector('.toc-for-mobile').style.position = "fixed";
            document.querySelector('.toc-for-mobile').style.top = wrapper_nav_top + wrapper_nav -6 +"px";
            open_toc.style.display = "block";
            open_toc.style.position = "fixed";
            open_toc.style.top = wrapper_nav + wrapper_nav_top + document.querySelector(".toc-for-mobile").offsetHeight - 6 + "px";
            open_toc.classList.add('entry-sidebar-active');
            
        } 
    
        window.onscroll = function() {toc_to_top()};
    }

function toc_to_top() {
    var mobile_toc = document.querySelector(".toc-for-mobile") ;
    var wrapper_nav = document.querySelector('#main-nav').offsetTop;
    var wrapper_nav_top = document.querySelector('#main-nav').offsetHeight;
    var article_header = document.querySelector('#article-header').clientHeight;
  
    if(window.scrollY  >= article_header ) {
        mobile_toc.classList.add('mobile_toc_active');
        document.querySelector('.toc-for-mobile').style.position = "fixed";
        document.querySelector('.toc-for-mobile').style.top = wrapper_nav_top + wrapper_nav -6 +"px";   
    }
    else if(window.scrollY <= article_header)  {
        document.querySelector('.toc-for-mobile').style.position = "relative";
        document.querySelector('.toc-for-mobile').style.top = 0;
    }
    var close_toc = document.querySelector('.entry-sidebar');
    close_toc.style.display = 'none';
}

// close mobile TOC dropdown on click outside
document.body.addEventListener('click', function(){
    var dropdown = document.querySelector('.collapsible');
    var toc_arrow = document.querySelector('.arrow');
    if(event.target != dropdown && event.target != toc_arrow &&  document.querySelector('.entry-sidebar').style.display == "block"){
            document.querySelector('.entry-sidebar').style.display = "none";   
        } 
});  