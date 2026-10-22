
export const Settings = {
    graphics: {
        advanced: 0,
        basic: 1
    },
    sound: {
        all: 0,
        nomusic: 1,
        Off: 2
    }
}
class EnvironmentSettings {
    private listeners = new Set<() => void>();
    onChange(listener: () => void) {
        this.listeners.add(listener);
        return { close: () => this.listeners.delete(listener) };
    }
    static Global: EnvironmentSettings | null = null;
    static getEnvironmentSetting() {
        if (EnvironmentSettings.Global === null) {
            EnvironmentSettings.Global = new EnvironmentSettings();
        }
        return EnvironmentSettings.Global;
    }
    get buildVersion() {
        return import.meta.env.VITE_BUILD_VERSION || "dev";
    }

    get isDev() {
        return import.meta.env.DEV === true;
    }

    constructor() {
        this.load();
    }

    load() {
        try {
            const dataString = localStorage.getItem("environment");
            if (dataString === null) {
                return;
            }
            let data = JSON.parse(dataString);
            this.data = data;
            for (const listener of this.listeners) listener();
        }
        catch (e) {
            console.error(e);
        }
    }
    save() {
        try {
            localStorage.setItem("environment", JSON.stringify(this.data));
        }
        catch (e) {
            console.error(e);
        }

    }

    data: Record<string, any> = {
        sound: Settings.sound.all,
        "music-volume": 100,
        "effects-volume": 100,
        graphics: Settings.graphics.advanced
    };
    sound: number = 0;
    graphics: number = 0;

    set(name: string, value: any) {
        if (this.data[name] === value) {
            return;
        }
        this.data[name] = value;
        for (const listener of this.listeners) listener();
        this.save();
    }
    get(name: string, def?: any) {
        return this.data[name] ?? def;
    }
}

export const Environment = EnvironmentSettings.getEnvironmentSetting();
