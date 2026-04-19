import filmStripSvg from '@phosphor-icons/core/assets/regular/film-strip.svg';
import infinitySvg from '@phosphor-icons/core/assets/regular/infinity.svg';

const BUTTON_ICON_ATTRIBUTES = 'class="oee-btn__icon" width="18" height="18" aria-hidden="true"';

function normaliseIconMarkup(svgMarkup) {
  return svgMarkup.replace('<svg ', `<svg ${BUTTON_ICON_ATTRIBUTES} `);
}

export const loopIconMarkup = normaliseIconMarkup(infinitySvg);
export const theatreIconMarkup = normaliseIconMarkup(filmStripSvg);
