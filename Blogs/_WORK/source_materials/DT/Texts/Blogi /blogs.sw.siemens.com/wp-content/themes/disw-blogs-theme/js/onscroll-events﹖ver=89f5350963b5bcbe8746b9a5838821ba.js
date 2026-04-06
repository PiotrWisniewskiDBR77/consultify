// function for onscroll events 
window.onload = function () {
        
    window.addEventListener("scroll", function() {

        // Single post progress bar
        var total_scroll = document.body.scrollTop || document.documentElement.scrollTop;
        var footer_section = document.querySelector(".disw-global-footer").offsetHeight;
        var post_additional_content = document.querySelector('.post-additional-content').offsetHeight;
        var main_nav = document.querySelector("#main-nav").offsetHeight;
        var top_of_main_nav = document.querySelector("#main-nav").offsetTop;
        var window_height = document.querySelector(".single-post").scrollHeight - footer_section - post_additional_content - main_nav - top_of_main_nav - 100 ;
        var page_scrolled = ( total_scroll / window_height ) * 100;

        document.querySelector(".post-progress-container").style.top = main_nav + top_of_main_nav + "px";
        document.querySelector(".post-progress-container").style.width = page_scrolled + "%";

        // End of Single post progress bar

        var height_of_toc = document.querySelector('.shortcode-toc'); // TOC element height
        if (height_of_toc){
            var height_of_toc = document.querySelector('.shortcode-toc').offsetHeight; // TOC element height
            var height_of_entry_content =  document.querySelector('.entry-content').getBoundingClientRect().top - height_of_toc ; // height of entry content from top of the page
           
        } else{
            var height_of_reading_time = document.querySelector('.rt-reading-time').offsetHeight; // reading time height
            var height_of_entry_content =  document.querySelector('.entry-content').getBoundingClientRect().top - ( 8 * height_of_reading_time); // height of entry content from top of the page
        }
        
        // check to see if window scroll crosses height_of_entry_content
        // if so display back to top button 
        if ( height_of_entry_content <= 0 ) {
            document.querySelector('.back-to-top').style.display = 'block';
        }else{
            document.querySelector('.back-to-top').style.display = 'none';
        }
       
    }, false);
}

// scroll behavior universal search 
window.onscroll = function() {universal_search()};
function universal_search() {
	var universal_header = document.getElementById("disw-header-search");
	universal_header.style.position = 'fixed';
 	universal_header.style.width = '100%';
	universal_header.style.marginTop = '35px';
    
   
}


