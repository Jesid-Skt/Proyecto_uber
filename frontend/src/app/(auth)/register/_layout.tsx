import { Tabs, TabList, TabSlot, TabTrigger } from 'expo-router/ui';
import { RegistrationProvider, registrationTabs } from '../../../context/RegistrationContext';

export default function RegistrationLayout() {
  return (
    <RegistrationProvider>
      <Tabs style={{ flex: 1 }}>
        <TabSlot />
        {/* Visible triggers live inside each form, below its progress indicator. */}
        <TabList style={{ display: 'none' }}>
          {registrationTabs.map(({ name, href }) => (
            <TabTrigger key={name} name={name} href={href} />
          ))}
        </TabList>
      </Tabs>
    </RegistrationProvider>
  );
}
