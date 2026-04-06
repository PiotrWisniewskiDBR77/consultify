jQuery(document).ready(function() {
  //------------------------- dropList js---------------------------------------
  jQuery(".dropList").click(function() {
      jQuery(this).find("ul").slideToggle(250);
  }
  );
  jQuery(".dropList ul li a").click(function() {
      var tt = $(this).text();
      jQuery(".selHeadDrop").html(tt);
  }
  );
//------------------------- Single post image height js---------------------------------------	
if ($('.single').length > 0){
	var imgWidth = $('.featured img').innerWidth();
	var imgHeight = imgWidth * 0.5625;
	//$('.featured img').height(imgHeight) ;
}
	if ($('.home').length > 0){
	var imgWidth = $('.home-slider .image-link img').innerWidth();
	var imgHeight = imgWidth * 0.5625;
	$('.home-slider .image-link img').height(imgHeight) ;
}

	if ($('.category').length > 0){
	var imgWidth = $('.blk-img img').innerWidth();
	var imgHeight = imgWidth * 0.5625;
	$('.blk-img img').height(imgHeight) ;
}

	if ($('.category').length > 0){
	var imgWidth = $('.slider .slides li').innerWidth();
	var imgHeight = imgWidth * 0.5625;
	$('.slider .slides li a').height(imgHeight) ;
	$('.slider .slides li a img').height(imgHeight) ;
}
	
	
	
  //------------------------- dropList js---------------------------------------
  
  function postListHeights(){
   var $postList = jQuery('.posts-list').find('.my-effect'); 
	 if ($('.category').length > 0){
		var imgWidth = $('.blk-img img').innerWidth();
		var imgHeight = imgWidth * 0.5625;
		$('.blk-img img').height(imgHeight) ;
	}
   var heights = $postList.map(function() {
      return jQuery(this).height();
   });

   var maxHeight = Math.max.apply(null, heights);
   $postList.height(maxHeight); 
	  
  }
	
	function imageSizes(){
		if ($('.archive').length > 0){
			var imgWidth = $('article a img').innerWidth();
			var imgHeight = imgWidth * 0.5625;
			$('article a img').height(imgHeight) ;
		}
		if ($('.search-results').length > 0){
			var imgWidth = $('article a img').innerWidth();
			var imgHeight = imgWidth * 0.5625;
			$('article a img').height(imgHeight) ;
		}
	}
	
	$(window).resize(function(){
		postListHeights();
	});	
	
	$(window).bind("load", function() {
		imageSizes();
		postListHeights();
		
});
	
	
	$(document).ajaxComplete(function(){
		imageSizes();
		setTimeout(postListHeights, 2000);
		
	});
	
	
   function channelSliderHeight(){
   var $sliderHeight = jQuery('.category').find('.slides').find('.caption');

   var heights = $sliderHeight.map(function() {
      return jQuery(this).height();
   });

   var maxHeight = Math.max.apply(this, heights);

   $sliderHeight.height(maxHeight);  
  }
  		channelSliderHeight();
	
	$(window).resize(function(){
		channelSliderHeight();
	});	
	
});