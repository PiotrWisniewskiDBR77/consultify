import {
  DayTableView,
  TableDateProfileGenerator
} from "./chunk-6APWUBRF.js";
import "./chunk-CASUXRP2.js";
import {
  createPlugin
} from "./chunk-BMU6RNDC.js";
import "./chunk-OL46QLBJ.js";

// ../../Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/node_modules/@fullcalendar/daygrid/index.js
var index = createPlugin({
  name: "@fullcalendar/daygrid",
  initialView: "dayGridMonth",
  views: {
    dayGrid: {
      component: DayTableView,
      dateProfileGeneratorClass: TableDateProfileGenerator
    },
    dayGridDay: {
      type: "dayGrid",
      duration: { days: 1 }
    },
    dayGridWeek: {
      type: "dayGrid",
      duration: { weeks: 1 }
    },
    dayGridMonth: {
      type: "dayGrid",
      duration: { months: 1 },
      fixedWeekCount: true
    },
    dayGridYear: {
      type: "dayGrid",
      duration: { years: 1 }
    }
  }
});
export {
  index as default
};
//# sourceMappingURL=@fullcalendar_daygrid.js.map
