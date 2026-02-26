// ===== SLIDE NAVIGATION =====
let currentSlide = 1;
const totalSlides = 12;

function showSlide(n) {
    document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('slide-' + n);
    if (target) {
        target.classList.add('active');
        currentSlide = n;
        document.getElementById('slideCounter').textContent = n + ' / ' + totalSlides;
        document.getElementById('progressFill').style.width = ((n / totalSlides) * 100) + '%';
        // Re-trigger animations
        target.querySelectorAll('.animate-fade-up').forEach(el => {
            el.style.animation = 'none';
            el.offsetHeight;
            el.style.animation = '';
        });
    }
}

function nextSlide() { if (currentSlide < totalSlides) showSlide(currentSlide + 1); }
function prevSlide() { if (currentSlide > 1) showSlide(currentSlide - 1); }

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextSlide(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prevSlide(); }
    if (e.key === 'Home') { e.preventDefault(); showSlide(1); }
    if (e.key === 'End') { e.preventDefault(); showSlide(totalSlides); }
});

// Touch/swipe navigation
let touchStartX = 0;
document.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; });
document.addEventListener('touchend', (e) => {
    const diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 60) { diff > 0 ? nextSlide() : prevSlide(); }
});

// Initialize
showSlide(1);
