import { navItems } from "../data/catalog";

export function createRouter({ onRouteChange }) {
  const resolve = () => {
    const route = location.hash.replace("#", "") || "home";
    return navItems.some((item) => item.route === route) ? route : "home";
  };

  const navigate = (route) => {
    if (route === resolve()) {
      onRouteChange(route);
      return;
    }
    location.hash = route;
  };

  window.addEventListener("hashchange", () => onRouteChange(resolve()));
  return {
    start: () => onRouteChange(resolve()),
    navigate,
    current: resolve
  };
}

export function activatePage(route) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.dataset.route === route);
  });
}

export function updatePageTitle(route) {
  const item = navItems.find((navItem) => navItem.route === route);
  document.querySelector("#page-kicker").textContent = item?.label || "الرئيسية";
  document.querySelector("#page-title").textContent = item?.title || "لوحة التشغيل";
}
