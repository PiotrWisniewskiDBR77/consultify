(function($) {
	$doc = $(document);

	$doc.ready( function() {

		/**
		 * Retrieve posts
		 */
		function get_posts($params) {
			
			//alert(JSON.stringify($params));

			$container = $('.searchpageresults');
			$content   = $container.find('.ajax-data');
			$status    = $container.find('.status');
			$pager     = $container.find('.infscr-pager a');

			//$status.text('Loading posts ...');
			$status.html('<div class="loader"></div>');

			/**
			 * Reset Pager for infinite scroll
			 */
			if ( $params.page === 1 && $pager.length ) {
				$pager.removeAttr('disabled').text('Load More');
			}

			if ( $pager.length ) {
				$method = 'infscr';
			}
			else {
				$method = 'pager';
			}

			/**
			 * Do AJAX
			 */
			$.ajax({
				url: spotlight.ajax_url,
				data: {
					action: 'do_filter_posts_mt',
					nonce: spotlight.nonce,
					params: $params,
					pager: $method
				},
				type: 'post',
				dataType: 'json',
				success: function(data, textStatus, XMLHttpRequest) {
					if (data.status === 200) {						
						if (data.method === 'pager' || $params.page === 1 ) {
							$content.html(data.content);
						}
						/**
						 * Append content for infinite scroll
						 */
						else {
							$content.append(data.content);
							if (data.next !== 0) {
								$pager.attr('href', '#page-' + data.next);
							}
						}
					}
					else if (data.status === 201) {
						$('.searchresultspage .posts-list').hide();
						$('.filter-area.have-posts').hide();
						if (data.method === 'pager' ) {
							$content.html(data.message);
						}
						else {
							$pager.attr('disabled', 'disabled').text('You reached the end');
						}
					}
					else {
						$status.html(data.message);
					}
				},
				error: function(MLHttpRequest, textStatus, errorThrown) {

					$status.html(textStatus);
				},
				complete: function(data, textStatus) {

					msg = textStatus;					
					if (textStatus === 'success') {
						msg = data.responseJSON.message;
					}					
					$status.html(msg);
				}
			});
		}

		/**
		 * Bind get_posts to tag cloud and navigation
		 */
		$('.ajax-data').on('click', 'a[data-filter], #close,  .search-submit, nav.pagination a', function(event) {
			if(event.preventDefault) { event.preventDefault(); }
			
			$this = $(this);
			
			var tabClass = $(this).attr('class');
			var removeActive  = '.sc-ajax-filter-multi .'+tabClass;
			
			if ($(this).attr('id') == 'close') {
				$(removeActive).parent().removeClass('active');
			}			
			$('.accordion .in').collapse('hide');
			$(this).parents('.accordion-group').next('.accordion-group').children('.accordion-heading').children('.accordion-toggle').trigger('click');//childrens('a.accordion-toggle').addClass( "click" );
			$('.hide-filter').hide();
			
			/**
			 * Set filter active
			 */
			 $SearchFieldVal = $('#search-field').val();
			 
			if ($this.data('filter') || $SearchFieldVal !=='' ) {
				$page = 1;
				
				/**
				 * If all terms, then deactivate all other
				 */
				if ($this.data('term') === 'all-terms') {
					$('ul.nav-filter,ul.date-filter').find('.active').removeClass('active');
				}
				else {
					$('a[data-term="all-terms"]').parent('div').removeClass('active');
				}
				if($this.parent().hasClass('active')){
					$this.parent('li').removeClass('active');
				}
				else{
				$this.closest('ul').find('.active').removeClass('active');
				 
				$this.parent('li').addClass('active');	
				}
				/**
				 * Get All Active Date Ranges
				 */
				$drange = {};
				$dateranges  = jQuery('ul.date-filter').find('.active');
				if ($dateranges.length) {
					$.each($dateranges, function(index, range) {
						
						$a    = $(range).find('a');
						$dtax  = $a.data('filter');
						$drange = $a.data('range');
											
					});
				}
				/**
				 * Get All Active Terms
				 */
				$active = {};
				$terms  = jQuery('ul.nav-filter').find('.active');
				if ($terms.length) {
					$.each($terms, function(index, term) {
						
						$a    = $(term).find('a');
						
						$tax  = $a.data('filter');
						$slug = $a.data('term');
						$range = $a.data('range');
						if ($tax in $active) {
							$active[$tax].push($slug);
						}
						else {
							$active[$tax]      = [];
							$active[$tax].push($slug);
						}						
					});
				}			
			}
			else {
				/**
				 * Pagination
				 */
				$page = parseInt($this.attr('href').replace(/\D/g,''));
				$this = $('.nav-filter .active a');
			}
			$params    = {
				'page'  : $page,
				'terms' : $active,
				'search_field' : $SearchFieldVal,
				'date_range' : $drange,
				'qty'   : $this.closest('.searchresultspage').data('paged'),
			};

			// Run query
			get_posts($params);
			
		});
	});

})(jQuery);
