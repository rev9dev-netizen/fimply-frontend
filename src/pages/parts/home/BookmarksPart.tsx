import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { EditButton } from "@/components/buttons/EditButton";
import { EditButtonWithText } from "@/components/buttons/EditButtonWithText";
import { Icons } from "@/components/Icon";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { MediaGrid } from "@/components/media/MediaGrid";
import { WatchedMediaCard } from "@/components/media/WatchedMediaCard";
import { EditBookmarkModal } from "@/components/overlays/EditBookmarkModal";
import { EditGroupModal } from "@/components/overlays/EditGroupModal";
import { useModal } from "@/components/overlays/Modal";
import { UserIcon, UserIcons } from "@/components/UserIcon";
import { useBookmarkStore } from "@/stores/bookmarks";
import { useGroupOrderStore } from "@/stores/groupOrder";
import { useProgressStore } from "@/stores/progress";
import { MediaItem } from "@/utils/mediaTypes";

function parseGroupString(group: string): { icon: UserIcons; name: string } {
  const match = group.match(/^\[([a-zA-Z0-9_]+)\](.*)$/);
  if (match) {
    const iconKey = match[1].toUpperCase() as keyof typeof UserIcons;
    const icon = UserIcons[iconKey] || UserIcons.BOOKMARK;
    const name = match[2].trim();
    return { icon, name };
  }
  return { icon: UserIcons.BOOKMARK, name: group };
}

export function BookmarksPart({
  onItemsChange,
  onShowDetails,
}: {
  onItemsChange: (hasItems: boolean) => void;
  onShowDetails?: (media: MediaItem) => void;
}) {
  const { t } = useTranslation();
  const progressItems = useProgressStore((s) => s.items);
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const groupOrder = useGroupOrderStore((s) => s.groupOrder);
  const removeBookmark = useBookmarkStore((s) => s.removeBookmark);
  const [editing, setEditing] = useState(false);
  const [gridRef] = useAutoAnimate<HTMLDivElement>();
  const editBookmarkModal = useModal("bookmark-edit");
  const editGroupModal = useModal("bookmark-edit-group");
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(
    null,
  );
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);
  const modifyBookmarks = useBookmarkStore((s) => s.modifyBookmarks);
  const modifyBookmarksByGroup = useBookmarkStore(
    (s) => s.modifyBookmarksByGroup,
  );

  const items = useMemo(() => {
    let output: MediaItem[] = [];
    Object.entries(bookmarks).forEach((entry) => {
      output.push({
        id: entry[0],
        ...entry[1],
      });
    });
    output = output.sort((a, b) => {
      const bookmarkA = bookmarks[a.id];
      const bookmarkB = bookmarks[b.id];
      const progressA = progressItems[a.id];
      const progressB = progressItems[b.id];

      const dateA = Math.max(bookmarkA.updatedAt, progressA?.updatedAt ?? 0);
      const dateB = Math.max(bookmarkB.updatedAt, progressB?.updatedAt ?? 0);

      return dateB - dateA;
    });
    return output;
  }, [bookmarks, progressItems]);

  const { groupedItems, regularItems } = useMemo(() => {
    const grouped: Record<string, MediaItem[]> = {};
    const regular: MediaItem[] = [];

    items.forEach((item) => {
      const bookmark = bookmarks[item.id];
      if (Array.isArray(bookmark?.group)) {
        bookmark.group.forEach((groupName) => {
          if (!grouped[groupName]) {
            grouped[groupName] = [];
          }
          grouped[groupName].push(item);
        });
      } else {
        regular.push(item);
      }
    });

    // Sort items within each group by date
    Object.keys(grouped).forEach((group) => {
      grouped[group].sort((a, b) => {
        const bookmarkA = bookmarks[a.id];
        const bookmarkB = bookmarks[b.id];
        const progressA = progressItems[a.id];
        const progressB = progressItems[b.id];

        const dateA = Math.max(bookmarkA.updatedAt, progressA?.updatedAt ?? 0);
        const dateB = Math.max(bookmarkB.updatedAt, progressB?.updatedAt ?? 0);

        return dateB - dateA;
      });
    });

    return { groupedItems: grouped, regularItems: regular };
  }, [items, bookmarks, progressItems]);

  const sortedSections = useMemo(() => {
    const sections: Array<{
      type: "grouped" | "regular";
      group?: string;
      items: MediaItem[];
    }> = [];

    const allSections = new Map<string, MediaItem[]>();

    Object.entries(groupedItems).forEach(([group, groupItems]) => {
      allSections.set(group, groupItems);
    });

    if (regularItems.length > 0) {
      allSections.set("bookmarks", regularItems);
    }

    if (groupOrder.length === 0) {
      allSections.forEach((sectionItems, group) => {
        if (group === "bookmarks") {
          sections.push({ type: "regular", items: sectionItems });
        } else {
          sections.push({ type: "grouped", group, items: sectionItems });
        }
      });
    } else {
      const orderMap = new Map(
        groupOrder.map((group, index) => [group, index]),
      );

      Array.from(allSections.entries())
        .sort(([groupA], [groupB]) => {
          const orderA = orderMap.has(groupA)
            ? orderMap.get(groupA)!
            : Number.MAX_SAFE_INTEGER;
          const orderB = orderMap.has(groupB)
            ? orderMap.get(groupB)!
            : Number.MAX_SAFE_INTEGER;
          return orderA - orderB;
        })
        .forEach(([group, sectionItems]) => {
          if (group === "bookmarks") {
            sections.push({ type: "regular", items: sectionItems });
          } else {
            sections.push({ type: "grouped", group, items: sectionItems });
          }
        });
    }

    return sections;
  }, [groupedItems, regularItems, groupOrder]);

  useEffect(() => {
    onItemsChange(items.length > 0);
  }, [items, onItemsChange]);

  const handleEditBookmark = (bookmarkId: string) => {
    setEditingBookmarkId(bookmarkId);
    editBookmarkModal.show();
  };

  const handleSaveBookmark = (bookmarkId: string, changes: any) => {
    modifyBookmarks([bookmarkId], changes);
    editBookmarkModal.hide();
    setEditingBookmarkId(null);
  };

  const handleEditGroup = (groupName: string) => {
    setEditingGroupName(groupName);
    editGroupModal.show();
  };

  const handleSaveGroup = (oldGroupName: string, newGroupName: string) => {
    modifyBookmarksByGroup({ oldGroupName, newGroupName });
    editGroupModal.hide();
    setEditingGroupName(null);
  };

  const handleCancelEditBookmark = () => {
    editBookmarkModal.hide();
    setEditingBookmarkId(null);
  };

  const handleCancelEditGroup = () => {
    editGroupModal.hide();
    setEditingGroupName(null);
  };

  if (items.length === 0) return null;

  return (
    <div className="relative">
      {/* Grouped Bookmarks */}
      {sortedSections.map((section) => {
        if (section.type === "grouped") {
          const { icon, name } = parseGroupString(section.group || "");
          return (
            <div key={section.group || "bookmarks"} className="mb-6">
              <SectionHeading
                title={name}
                customIcon={
                  <span className="w-6 h-6 flex items-center justify-center">
                    <UserIcon icon={icon} className="w-full h-full" />
                  </span>
                }
              >
                <div className="flex items-center gap-2">
                  {editing && section.group && (
                    <EditButtonWithText
                      editing={editing}
                      onEdit={() => handleEditGroup(section.group!)}
                      id="edit-group-button"
                      text={t("home.bookmarks.groups.editGroup.title")}
                      secondaryText={t(
                        "home.bookmarks.groups.editGroup.cancel",
                      )}
                    />
                  )}
                  <EditButton
                    editing={editing}
                    onEdit={setEditing}
                    id={`edit-button-bookmark-${section.group}`}
                  />
                </div>
              </SectionHeading>
              <MediaGrid>
                {section.items.map((v) => (
                  <div
                    key={v.id}
                    onContextMenu={(e: React.MouseEvent<HTMLDivElement>) =>
                      e.preventDefault()
                    }
                    className="relative group"
                  >
                    <WatchedMediaCard
                      media={v}
                      closable={editing}
                      onClose={() => removeBookmark(v.id)}
                      onShowDetails={onShowDetails}
                      editable={editing}
                      onEdit={() => handleEditBookmark(v.id)}
                    />
                  </div>
                ))}
              </MediaGrid>
            </div>
          );
        } // regular items
        return (
          <div key="regular-bookmarks" className="mb-6">
            <SectionHeading
              title={t("home.bookmarks.sectionTitle")}
              icon={Icons.BOOKMARK}
            >
              <div className="flex items-center gap-2">
                <EditButton
                  editing={editing}
                  onEdit={setEditing}
                  id="edit-button-bookmark"
                />
              </div>
            </SectionHeading>
            <MediaGrid ref={gridRef}>
              {section.items.map((v) => (
                <div
                  key={v.id}
                  onContextMenu={(e: React.MouseEvent<HTMLDivElement>) =>
                    e.preventDefault()
                  }
                  className="relative group"
                >
                  <WatchedMediaCard
                    media={v}
                    closable={editing}
                    onClose={() => removeBookmark(v.id)}
                    onShowDetails={onShowDetails}
                    editable={editing}
                    onEdit={() => handleEditBookmark(v.id)}
                  />
                </div>
              ))}
            </MediaGrid>
          </div>
        );
      })}

      {/* Edit Bookmark Modal */}
      <EditBookmarkModal
        id={editBookmarkModal.id}
        isShown={editBookmarkModal.isShown}
        bookmarkId={editingBookmarkId}
        onCancel={handleCancelEditBookmark}
        onSave={handleSaveBookmark}
      />

      {/* Edit Group Modal */}
      <EditGroupModal
        id={editGroupModal.id}
        isShown={editGroupModal.isShown}
        groupName={editingGroupName}
        onCancel={handleCancelEditGroup}
        onSave={handleSaveGroup}
      />
    </div>
  );
}
