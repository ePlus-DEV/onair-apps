import { defineStore } from "pinia";
import world from "~/data/world";

interface World {
  [area: string]: {
    [country: string]: {
      timezone: string;
    };
  };
}

interface Player {
  objectID: string;
  station_name: string;
  station_country: string;
  station_image: string;
  station_stream: string;
  type: string;
  cros: boolean;
  favorite: boolean;
  station_schedule?: string;
  url: string;
}

interface State {
  player: Player;
  player_home: Player;
  timezone: string;
}

export const useMainStore = defineStore("main", {
  state: (): State => ({
    player: {
      objectID: "",
      station_name: "",
      station_country: "",
      station_image: "",
      station_stream: "",
      type: "",
      cros: false,
      favorite: false,
      station_schedule: "",
      url: "",
    },
    player_home: {
      objectID: "",
      station_name: "",
      station_country: "",
      station_image: "",
      station_stream: "",
      type: "",
      cros: false,
      favorite: false,
      station_schedule: "",
      url: "",
    },
    timezone: "Asia/Ho_Chi_Minh",
  }),
  actions: {
    setPlayer(player: Player) {
      this.player = player;
    },
    setPlayerHome(player_home: Player) {
      this.player_home = player_home;
    },
    setTimezone(area: string, country: string) {
      const timezone =
        (world as World)[area]?.[country]?.timezone || "Asia/Ho_Chi_Minh";
      this.timezone = timezone;
    },
  },
  getters: {
    getPlayer(): Player {
      return this.player;
    },
    getPlayerHome(): Player {
      return this.player_home;
    },
    getTimezone(): string {
      return this.timezone;
    },
  },
});
