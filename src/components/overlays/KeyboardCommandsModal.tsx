import { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Modal, ModalCard } from "@/components/overlays/Modal";
import { Heading2 } from "@/components/utils/Text";

interface KeyboardShortcut {
  key: string;
  description: string;
  condition?: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: KeyboardShortcut[];
}

const getShortcutGroups = (t: (key: string) => string): ShortcutGroup[] => [
  {
    title: t("global.keyboardShortcuts.groups.videoPlayback"),
    shortcuts: [
      {
        key: "Space",
        description: t("global.keyboardShortcuts.shortcuts.playPause"),
      },
      {
        key: "K",
        description: t("global.keyboardShortcuts.shortcuts.playPauseAlt"),
      },
      {
        key: "→",
        description: t("global.keyboardShortcuts.shortcuts.skipForward5"),
      },
      {
        key: "←",
        description: t("global.keyboardShortcuts.shortcuts.skipBackward5"),
      },
      {
        key: "J",
        description: t("global.keyboardShortcuts.shortcuts.skipBackward10"),
      },
      {
        key: "L",
        description: t("global.keyboardShortcuts.shortcuts.skipForward10"),
      },
      {
        key: ".",
        description: t("global.keyboardShortcuts.shortcuts.skipForward1"),
        condition: t("global.keyboardShortcuts.conditions.whenPaused"),
      },
      {
        key: ",",
        description: t("global.keyboardShortcuts.shortcuts.skipBackward1"),
        condition: t("global.keyboardShortcuts.conditions.whenPaused"),
      },
    ],
  },
  {
    title: t("global.keyboardShortcuts.groups.jumpToPosition"),
    shortcuts: [
      {
        key: "0",
        description: t("global.keyboardShortcuts.shortcuts.jumpTo0"),
      },
      {
        key: "9",
        description: t("global.keyboardShortcuts.shortcuts.jumpTo9"),
      },
    ],
  },
  {
    title: t("global.keyboardShortcuts.groups.audioVideo"),
    shortcuts: [
      {
        key: "↑",
        description: t("global.keyboardShortcuts.shortcuts.increaseVolume"),
      },
      {
        key: "↓",
        description: t("global.keyboardShortcuts.shortcuts.decreaseVolume"),
      },
      { key: "M", description: t("global.keyboardShortcuts.shortcuts.mute") },
      {
        key: ">/",
        description: t("global.keyboardShortcuts.shortcuts.changeSpeed"),
        condition: t("global.keyboardShortcuts.conditions.notInWatchParty"),
      },
      {
        key: "F",
        description: t("global.keyboardShortcuts.shortcuts.toggleFullscreen"),
      },
    ],
  },
  {
    title: t("global.keyboardShortcuts.groups.subtitlesAccessibility"),
    shortcuts: [
      {
        key: "C",
        description: t("global.keyboardShortcuts.shortcuts.toggleCaptions"),
      },
      {
        key: "[",
        description: t(
          "global.keyboardShortcuts.shortcuts.syncSubtitlesEarlier",
        ),
      },
      {
        key: "]",
        description: t("global.keyboardShortcuts.shortcuts.syncSubtitlesLater"),
      },
    ],
  },
  {
    title: t("global.keyboardShortcuts.groups.interface"),
    shortcuts: [
      {
        key: "R",
        description: t("global.keyboardShortcuts.shortcuts.barrelRoll"),
      },
      {
        key: "Escape",
        description: t("global.keyboardShortcuts.shortcuts.closeOverlay"),
      },
      {
        key: "Shift",
        description: t("global.keyboardShortcuts.shortcuts.copyLinkWithTime"),
      },
      {
        key: "Shift",
        description: t("global.keyboardShortcuts.shortcuts.widescreenMode"),
      },
    ],
  },
];

function KeyBadge({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 text-sm font-mono bg-gray-800 text-gray-200 rounded border border-gray-600 shadow-sm">
      {children}
    </kbd>
  );
}

interface KeyboardCommandsModalProps {
  id: string;
}

export function KeyboardCommandsModal({ id }: KeyboardCommandsModalProps) {
  const { t } = useTranslation();
  const shortcutGroups = getShortcutGroups(t);

  return (
    <Modal id={id}>
      <ModalCard>
        <div className="space-y-6">
          <div className="text-center">
            <Heading2 className="!mt-0 !mb-2">
              {t("global.keyboardShortcuts.title")}
            </Heading2>
            <p className="text-type-secondary text-lg">
              {(() => {
                const subtitle = t("global.keyboardShortcuts.subtitle");
                const [before, after] = subtitle.split("`");
                return (
                  <>
                    {before}
                    <KeyBadge>`</KeyBadge>
                    {after}
                  </>
                );
              })()}
            </p>
          </div>

          <div className="space-y-6 max-h-[60vh] overflow-y-auto">
            {shortcutGroups.map((group) => (
              <div key={group.title} className="space-y-3">
                <h3 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">
                  {group.title}
                </h3>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.key}
                      className="flex items-center justify-between py-1"
                    >
                      <div className="flex items-center gap-3">
                        <KeyBadge>{shortcut.key}</KeyBadge>
                        <span className="text-type-secondary">
                          {shortcut.description}
                        </span>
                      </div>
                      {shortcut.condition && (
                        <span className="text-xs text-gray-400 italic">
                          {shortcut.condition}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </ModalCard>
    </Modal>
  );
}
