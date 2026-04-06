// collapsible for nav-menu
jQuery( document ).ready( function($) { 

  $( '.navbar-toggler' ).click( function() {
    if ( $(window).width() < 992 ) {
      $('#navbarNavDropdown').toggle();
      $(this).find(".navbar-icon").toggleClass("change");
    }
  });

  // start product
  $(".product-link").on("click", function() {
    if ( $(window).width() < 992 ) {
      $('.productsDropdown').toggle();
      $(this).find("#menu-item-dropdown-26").toggleClass("change");
    }
  });

  $(".product-link").on("mouseenter", function() {
    if ( $(window).width() > 992 ) {
      // make sure it is not shown:
      $('.productsDropdown').show();
      $(this).find("#menu-item-dropdown-26").addClass("change");
    }
  });
  
  $(".product-link").on("mouseleave", function() {
    // make sure it is not shown:
    if ( $(window).width() > 992 ) {
      $('.productsDropdown').hide();
      $(this).find("#menu-item-dropdown-26").removeClass("change");
    }
  });
  // end product

  // start industry
  $( '.industry-link' ).on("click", function() {
    if ( $(window).width() < 992 ) {
      $('.industriesDropdown').toggle();
      $(this).find("#menu-item-dropdown-industries").toggleClass("change");
    }
  });

  $(".industry-link").on("mouseenter", function() {
    if ( $(window).width() > 992 ) {
      $('.industriesDropdown').show();
      $(this).find("#menu-item-dropdown-industries").addClass("change");
    }
  });
  
  $(".industry-link").on("mouseleave", function() {
    if ( $(window).width() > 992 ) {
      $('.industriesDropdown').hide();
      $(this).find("#menu-item-dropdown-industries").removeClass("change");
    }
  });
  // end industry

  // start podcast
   $( '.podcast-link' ).on("click", function() {
    if ( $(window).width() < 992 ) {
      $('.podcastsDropdown').toggle();
      $(this).find("#menu-item-dropdown-80").toggleClass("change");
    }
  });

  $(".podcast-link").on("mouseenter", function() {
    if ( $(window).width() > 992 ) {
      $('.podcastsDropdown').show();
      $(this).find("#menu-item-dropdown-80").addClass("change");
    }
  });
  
  $(".podcast-link").on("mouseleave", function() {
    if ( $(window).width() > 992 ) {
      $('.podcastsDropdown').hide();
      $(this).find("#menu-item-dropdown-80").removeClass("change");
    }
  });
  // end podcast

  // start thought leadership
  $( '.thought-leadership-link' ).on("click", function() {
    if ( $(window).width() < 992 ) {
      $('.thoughtLeadershipDropdown').toggle();
      $(this).find("#menu-item-dropdown-52").toggleClass("change");
    }
  });

  $(".thought-leadership-link").on("mouseenter", function() {
    if ( $(window).width() > 992 ) {
      // make sure it is not shown:
      $('.thoughtLeadershipDropdown').show();
      $(this).find("#menu-item-dropdown-52").addClass("change");
    }
  });
  
  $(".thought-leadership-link").on("mouseleave", function() {
    if ( $(window).width() > 992 ) {
      // make sure it is not shown:
      $('.thoughtLeadershipDropdown').hide();
      $(this).find("#menu-item-dropdown-52").removeClass("change");
    }
  });
  // end thought leadership

  // start corporate
  $( '.corporate-link' ).on("click", function() {
    if ( $(window).width() < 992 ) {
      $('.corporateDropdown').toggle();
      $(this).find("#menu-item-dropdown-27").toggleClass("change");
    }
  });

  $(".corporate-link").on("mouseenter", function() {
    if ( $(window).width() > 992 ) {
      $('.corporateDropdown').show();
      $(this).find("#menu-item-dropdown-27").addClass("change");
    }
  });
  
  $(".corporate-link").on("mouseleave", function() {
    if ( $(window).width() > 992 ) {
      $('.corporateDropdown').hide();
      $(this).find("#menu-item-dropdown-27").removeClass("change");
    }
  });

});