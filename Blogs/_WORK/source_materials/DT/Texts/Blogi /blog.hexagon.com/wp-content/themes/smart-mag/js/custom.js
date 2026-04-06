//Function for category filtering with year.

(function( $ ) {
jQuery(document).on("click","#categoryyearsearch",function(){
    var siteurl = $('#siteurl').val();
    var categoryval = $('#category-dropdown option:selected').val();
    // code for getting the year value from the Year archive dropdown value starts here
    var yearstring = $('#year-dropdown option:selected').val();
    yearstring = yearstring.slice(0,-1);
    yearstring = yearstring.split('/');
    var yearval = yearstring.pop();
    // code for getting the year value from the Year archive dropdown value ends here


    if(categoryval != "" && yearval != ""){ // If both Category and Year selected
      window.location.href = siteurl+"/"+yearval+"?category_name="+categoryval;
    }else if(categoryval != "") {    // If only Category is selected
      window.location.href = siteurl + "/category/" + categoryval;
      }else if(yearval != "") {    // If only Year is selected
        window.location.href = siteurl + "/" + yearval;
      }else{// If only year is selected
        alert('Please Select category or year');
        //window.location.href(siteurl+"/"+'categories');
      }
    });

  jQuery(document).on('click','a[data-target="#navigation"]',function(){
    jQuery(document).find('span.caret').toggleClass('minus');
  })

  jQuery(document).on('ready',function(){
    jQuery(this).find('.nav-links ul li').each(function () {
      if(jQuery(this).find('.dropdown-menu').length > 0) {
        jQuery(this).addClass('has-menu');
      }
    });
    jQuery(this).find('.nav-links ul.sub-menu li').removeClass('has-menu');
  })

  jQuery(document).on('ready',function(){
    jQuery(this).find('.nav-links ul.sub-menu li div.dropdown-menu').parent('li').addClass('dropdown-submenu');
  })

   jQuery(document).on('mouseover','.nav-links li a',function(){
    jQuery(this).addClass('active')
    jQuery(this).parent('li').addClass('active')
  })
  jQuery(document).on('mouseout','.nav-links li a',function(){
    jQuery(this).removeClass('active')
    jQuery(this).parent('li').removeClass('active')
  })
  jQuery(document).on('mouseover','.dropdown-menu',function(){
    jQuery(this).prev('a').addClass('active')
  })
  jQuery(document).on('mouseout','.dropdown-menu',function(){
    jQuery(this).prev('a').removeClass('active')
  });

  jQuery(document).on('ready',function() {
    if(jQuery(window).width() >= 732) {
      var count = jQuery(".list-unstyled li").length;
      if (count <= 16) {
        jQuery('.navigation .links ul').css('overflow', 'hidden');
      }
    }
    });

})( jQuery );

