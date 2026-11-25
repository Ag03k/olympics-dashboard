/** Material Symbols (Outlined, weight 400) inlined as SVG at build time — no font or CDN request. */
import ic_barChart from '@material-symbols/svg-400/outlined/bar_chart.svg?raw';
import ic_info from '@material-symbols/svg-400/outlined/info.svg?raw';
import ic_trophy from '@material-symbols/svg-400/outlined/trophy.svg?raw';
import ic_straighten from '@material-symbols/svg-400/outlined/straighten.svg?raw';
import ic_monitorWeight from '@material-symbols/svg-400/outlined/monitor_weight.svg?raw';
import ic_cake from '@material-symbols/svg-400/outlined/cake.svg?raw';
import ic_calendarMonth from '@material-symbols/svg-400/outlined/calendar_month.svg?raw';
import ic_sunny from '@material-symbols/svg-400/outlined/sunny.svg?raw';
import ic_acUnit from '@material-symbols/svg-400/outlined/ac_unit.svg?raw';
import ic_public from '@material-symbols/svg-400/outlined/public.svg?raw';
import ic_groups from '@material-symbols/svg-400/outlined/groups.svg?raw';
import ic_stadium from '@material-symbols/svg-400/outlined/stadium.svg?raw';
import ic_militaryTech from '@material-symbols/svg-400/outlined/military_tech.svg?raw';
import ic_openInNew from '@material-symbols/svg-400/outlined/open_in_new.svg?raw';
import ic_tune from '@material-symbols/svg-400/outlined/tune.svg?raw';
import ic_eventBusy from '@material-symbols/svg-400/outlined/event_busy.svg?raw';
import ic_timeline from '@material-symbols/svg-400/outlined/timeline.svg?raw';
import ic_menuBook from '@material-symbols/svg-400/outlined/menu_book.svg?raw';
import ic_database from '@material-symbols/svg-400/outlined/database.svg?raw';
import ic_lightbulb from '@material-symbols/svg-400/outlined/lightbulb.svg?raw';
import ic_warning from '@material-symbols/svg-400/outlined/warning.svg?raw';
import ic_leaderboard from '@material-symbols/svg-400/outlined/leaderboard.svg?raw';
import ic_license from '@material-symbols/svg-400/outlined/license.svg?raw';
import ic_photoLibrary from '@material-symbols/svg-400/outlined/photo_library.svg?raw';
import ic_formatQuote from '@material-symbols/svg-400/outlined/format_quote.svg?raw';
import ic_flag from '@material-symbols/svg-400/outlined/flag.svg?raw';
import ic_sprint from '@material-symbols/svg-400/outlined/sprint.svg?raw';
import ic_tableChart from '@material-symbols/svg-400/outlined/table_chart.svg?raw';
import ic_touchApp from '@material-symbols/svg-400/outlined/touch_app.svg?raw';

const ICONS = {
  bar_chart: ic_barChart,
  info: ic_info,
  trophy: ic_trophy,
  straighten: ic_straighten,
  monitor_weight: ic_monitorWeight,
  cake: ic_cake,
  calendar_month: ic_calendarMonth,
  sunny: ic_sunny,
  ac_unit: ic_acUnit,
  public: ic_public,
  groups: ic_groups,
  stadium: ic_stadium,
  military_tech: ic_militaryTech,
  open_in_new: ic_openInNew,
  tune: ic_tune,
  event_busy: ic_eventBusy,
  timeline: ic_timeline,
  menu_book: ic_menuBook,
  database: ic_database,
  lightbulb: ic_lightbulb,
  warning: ic_warning,
  leaderboard: ic_leaderboard,
  license: ic_license,
  photo_library: ic_photoLibrary,
  format_quote: ic_formatQuote,
  flag: ic_flag,
  sprint: ic_sprint,
  table_chart: ic_tableChart,
  touch_app: ic_touchApp,
} as const;

export type IconName = keyof typeof ICONS;

/** Returns inline SVG markup sized to 1em, inheriting currentColor. */
export function icon(name: IconName): string {
  return ICONS[name]
    .replace(/width="\d+"/, 'width="1em"')
    .replace(/height="\d+"/, 'height="1em"')
    .replace('<svg ', '<svg aria-hidden="true" focusable="false" fill="currentColor" ');
}

/** Replace every <i data-icon="name"></i> placeholder in a root with the SVG. */
export function hydrateIcons(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => {
    const name = el.dataset.icon as IconName;
    if (name in ICONS) el.innerHTML = icon(name);
  });
}
