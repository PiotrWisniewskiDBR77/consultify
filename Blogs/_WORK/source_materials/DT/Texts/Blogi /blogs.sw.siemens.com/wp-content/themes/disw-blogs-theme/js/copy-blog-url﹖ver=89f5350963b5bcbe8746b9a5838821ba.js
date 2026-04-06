// Copy link of blog and display tooltip after the link is copied
var copy_blog_url = document.querySelector('.social-share-button');
var tooltip = document.getElementById('copy-link');

// Display tooltip after link is copied
copy_blog_url.addEventListener('click', function() {
  document.execCommand("copy");
  if (this.classList.contains('active')) {
    this.classList.remove('active');
  } else {
    this.classList.add('active');
    tooltip.innerHTML = "Link copied to clipboard";
  }
});

// change display to 'block' on mouseover
copy_blog_url.addEventListener('mouseover', () => {
  tooltip.style.display = 'block';
}, false);

// change display to 'none' on mouseleave
copy_blog_url.addEventListener('mouseleave', () => {
  tooltip.style.display = 'none';
}, false);

// Copy URL to clipboard
copy_blog_url.addEventListener("copy", function(event) {
  event.preventDefault();
  if (event.clipboardData && tooltip.innerHTML === 'Copy link') {
    event.clipboardData.setData("text/plain", copy_blog_url.getAttribute("href"));
  }
});
