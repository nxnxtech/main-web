window.NxNxComponents = window.NxNxComponents || {};

window.NxNxComponents.businessCard = `
<div class="business-card-container">
  <!-- Floating button in bottom-right -->
  <button class="business-card-button" aria-label="Open business card" title="View business card">
    <svg class="icon" viewBox="0 0 44 44"><rect width="44" height="44" rx="8" fill="none"/><rect x="8" y="12" width="28" height="20" rx="3" fill="var(--white)" stroke="var(--ink)" stroke-width="2.4"/><path d="M8 18 H36" stroke="var(--ink)" stroke-width="1.5"/>
    <path d="M8 18 H36" stroke="var(--ink)" stroke-width="1.5"/>
    <path d="M8 24 H36" stroke="var(--ink)" stroke-width="1.5"/>
    </svg>
  </button>

  <!-- Modal overlay and card -->
  <div class="business-card-modal">
    <div class="business-card-backdrop"></div>
    <div class="business-card-content">
      <div class="card-wrapper">
        <img class="bg-image-cover" src="../images/nobg-design.png" alt="Design background" class="card-background">
        <img src="../images/b-card.png" alt="Business Card - Nana Nketia, Founder & CEO" class="card-image">
      </div>
      <button class="business-card-close" aria-label="Close business card">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <!-- Download button -->
      <a aria-label="Download business card" title="Download business card" href="../images/b-card.png" download="Nana-Nketia-Business-Card.png">
      <button class="business-card-download btn" type-"button">
        <svg width="200" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line> 
        </svg>
        </button>
      </a>
    </div>
  </div>
</div>`;
