import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Container,
  Group,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core';
import {
  DEFAULT_SETTINGS,
  FEATURE_KEYS,
  FEATURE_LABELS,
  type FeatureKey,
  type Settings,
} from '../../utils/constants';
import { getSettings, setSettings, onSettingsChanged } from '../../utils/storage';

export default function App() {
  const [settings, setSettingsState] = useState<Settings | null>(null);

  useEffect(() => {
    void getSettings().then(setSettingsState);
    return onSettingsChanged(setSettingsState);
  }, []);

  if (!settings) return null;

  const sites = Object.entries(settings.sites).sort(([a], [b]) => a.localeCompare(b));

  const setDefault = (key: FeatureKey, value: boolean): void => {
    void setSettings({
      ...settings,
      defaults: { ...settings.defaults, [key]: value },
    });
  };

  const setSiteEnabled = (host: string, enabled: boolean): void => {
    const next: Settings = structuredClone(settings);
    const site = next.sites[host];
    if (!site) return;
    site.enabled = enabled;
    void setSettings(next);
  };

  const removeSite = (host: string): void => {
    const next: Settings = structuredClone(settings);
    delete next.sites[host];
    void setSettings(next);
  };

  const resetAll = (): void => {
    if (window.confirm('Reset all Window Ninja settings?')) {
      void setSettings(structuredClone(DEFAULT_SETTINGS));
    }
  };

  return (
    <Container size={480} py={20} px={16} className="wn-rise">
      <Stack gap={16}>
        <Title order={3}>Window Ninja</Title>

        <Stack gap={6}>
          <Title order={5}>Default features</Title>
          <Text size="xs" c="dimmed">
            Applied whenever a site is enabled from the popup.
          </Text>
          <Card withBorder radius="md" p="xs">
            <Stack gap={0}>
              {FEATURE_KEYS.map((key, i) => (
                <Group
                  key={key}
                  justify="space-between"
                  wrap="nowrap"
                  py={6}
                  px={8}
                  className={`wn-rise wn-rise-${i + 1}`}
                  style={{ borderRadius: 8, cursor: 'pointer' }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('.mantine-Switch-root')) return;
                    setDefault(key, !settings.defaults[key]);
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
                    checked={settings.defaults[key]}
                    onChange={(e) => setDefault(key, e.currentTarget.checked)}
                  />
                </Group>
              ))}
            </Stack>
          </Card>
        </Stack>

        <Stack gap={6}>
          <Title order={5}>Configured sites</Title>
          {sites.length === 0 ? (
            <Text size="sm" c="dimmed">
              None yet — enable sites from the popup toolbar.
            </Text>
          ) : (
            <Card withBorder radius="md" p="xs">
              <Stack gap={0}>
                {sites.map(([host, site], i) => (
                  <Group
                    key={host}
                    justify="space-between"
                    wrap="nowrap"
                    py={6}
                    px={8}
                    className={`wn-rise wn-rise-${(i % 6) + 1}`}
                    style={{ borderRadius: 8 }}
                  >
                    <Text size="sm" fw={600} style={{ flex: 1, wordBreak: 'break-all' }}>
                      {host}
                    </Text>
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      {site.erasedSelectors.length} erased
                    </Text>
                    <Switch
                      size="sm"
                      checked={site.enabled}
                      onChange={(e) => setSiteEnabled(host, e.currentTarget.checked)}
                    />
                    <Button
                      size="compact-xs"
                      variant="light"
                      onClick={() => removeSite(host)}
                    >
                      Remove
                    </Button>
                  </Group>
                ))}
              </Stack>
            </Card>
          )}
        </Stack>

        <Stack gap={6}>
          <Card withBorder radius="md" p="sm">
            <Stack gap={6}>
              <Button variant="light" style={{ alignSelf: 'flex-start' }} onClick={resetAll}>
                Reset all settings
              </Button>
              <Text size="xs" c="dimmed">
                Window Ninja stores only your preferences via Chrome sync. It collects nothing.
              </Text>
            </Stack>
          </Card>
        </Stack>
      </Stack>
    </Container>
  );
}
