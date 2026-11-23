import { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Group,
  Kbd,
  Loader,
  Paper,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import {
  FEATURE_KEYS,
  FEATURE_LABELS,
  WN_COMMAND_MESSAGE,
  type FeatureKey,
  type Settings,
  type WnCommand,
} from '../../utils/constants';
import {
  getEffectiveFeatures,
  getSettings,
  getSiteSettings,
  onSettingsChanged,
  updateSite,
} from '../../utils/storage';

export default function App() {
  const [tab, setTab] = useState<Browser.tabs.Tab | null>(null);
  const [settings, setSettingsState] = useState<Settings | null>(null);

  useEffect(() => {
    void browser.tabs.query({ active: true, currentWindow: true }).then(([t]) => setTab(t ?? null));
    void getSettings().then(setSettingsState);
    return onSettingsChanged(setSettingsState);
  }, []);

  const url = tab?.url;
  const supported = !!url && /^https?:/i.test(url);
  const host = (() => {
    try {
      return url ? new URL(url).hostname : null;
    } catch {
      return null;
    }
  })();

  const site = settings && host ? getSiteSettings(settings, host) : null;
  const features = settings && host ? getEffectiveFeatures(settings, host) : null;

  const toggleSite = useCallback(
    (enabled: boolean) => {
      if (!host) return;
      void updateSite(host, (s) => {
        s.enabled = enabled;
      });
    },
    [host],
  );

  const toggleFeature = useCallback(
    (key: FeatureKey, value: boolean) => {
      if (!host) return;
      void updateSite(host, (s) => {
        s.features[key] = value;
      });
    },
    [host],
  );

  const runCommand = useCallback(
    (command: WnCommand) => {
      if (!tab?.id) return;
      void browser.tabs
        .sendMessage(tab.id, { type: WN_COMMAND_MESSAGE, command })
        .catch(() => undefined);
    },
    [tab],
  );

  if (!settings) {
    return (
      <Box p={16} className="wn-rise">
        <Loader size="sm" />
      </Box>
    );
  }

  return (
    <Stack gap={8} p={10} className="wn-rise">
      {!supported || !host || !site || !features ? (
        <Text c="dimmed">Open a website to control Window Ninja here.</Text>
      ) : (
        <>
          <Paper withBorder radius="md" p={10}>
            <Group justify="space-between" wrap="nowrap">
              <Box miw={0}>
                <Text fw={600} size="sm" truncate>
                  {host}
                </Text>
                <Text size="xs" c="dimmed">
                  Enable on this site
                </Text>
              </Box>
              <Switch checked={site.enabled} onChange={(e) => toggleSite(e.currentTarget.checked)} />
            </Group>
          </Paper>

          <Paper
            withBorder
            radius="md"
            p="xs"
            style={{ opacity: site.enabled ? 1 : 0.45, pointerEvents: site.enabled ? undefined : 'none' }}
          >
            <Stack gap={0}>
              {FEATURE_KEYS.map((key, i) => (
                <Group
                  key={key}
                  justify="space-between"
                  wrap="nowrap"
                  py={4}
                  px={6}
                  className={`wn-rise wn-rise-${i + 1}`}
                  style={{ borderRadius: 8, cursor: 'pointer' }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('.mantine-Switch-root')) return;
                    toggleFeature(key, !features[key]);
                  }}
                >
                  <Box>
                    <Text size="sm" fw={600}>
                      {FEATURE_LABELS[key].title}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {FEATURE_LABELS[key].hint}
                    </Text>
                  </Box>
                  <Switch
                    size="sm"
                    checked={features[key]}
                    disabled={!site.enabled}
                    onChange={(e) => toggleFeature(key, e.currentTarget.checked)}
                  />
                </Group>
              ))}
            </Stack>
          </Paper>

          <Button
            variant="default"
            fullWidth
            justify="space-between"
            rightSection={<Kbd size="xs">Alt+Shift+E</Kbd>}
            onClick={() => runCommand('erase-mode')}
          >
            Erase element
          </Button>
          <Button
            variant="default"
            fullWidth
            justify="space-between"
            rightSection={<Kbd size="xs">Alt+Shift+S</Kbd>}
            onClick={() => runCommand('select-mode')}
          >
            Select text
          </Button>
          <Button
            variant="default"
            fullWidth
            title="Restore erased"
            aria-label="Restore erased"
            justify="space-between"
            disabled={!site.erasedSelectors.length}
            leftSection={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 14l-4 -4l4 -4" />
                <path d="M5 10h11a4 4 0 1 1 0 8h-1" />
              </svg>
            }
            rightSection={
              <Badge size="xs" variant="light" color="gray">
                {site.erasedSelectors.length}
              </Badge>
            }
            onClick={() => runCommand('restore-erased')}
          >
            Restore erased
          </Button>
          <Button variant="default" fullWidth onClick={() => runCommand('remove-overlays')}>
            Remove overlays
          </Button>
        </>
      )}
    </Stack>
  );
}
