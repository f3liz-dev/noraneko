/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  VStack,
  Text,
  Divider,
  Flex,
  Switch,
  FormLabel,
  FormControl,
  FormHelperText,
  useDisclosure,
} from "@chakra-ui/react";
import Card from "@/components/Card";
import RestartWarningDialog from "@/components/RestartWarningDialog";
import React from "react";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { WorkspacesFormData } from "@/type";

export default function Preferences() {
  const { t } = useTranslation();
  const { control } = useFormContext<WorkspacesFormData>();

  const {
    isOpen: isOpenEnableWorkspaces,
    onOpen: onOpenEnableWorkspaces,
    onClose: onCloseEnableWorkspaces,
  } = useDisclosure();

  return (
    <>
      <RestartWarningDialog
        description={t("workspaces.needRestartDescriptionForEnableAndDisable")}
        onClose={onCloseEnableWorkspaces}
        isOpen={isOpenEnableWorkspaces}
      />
      <Card
        icon={
          <IconMaterialSymbolsLightSelectWindow
            style={{ fontSize: "24px", color: "#3164ff" }}
          />
        }
        title={t("workspaces.basicSettings")}
        footerLink="https://docs.floorp.app/docs/features/how-to-use-workspaces"
        footerLinkText={t("workspaces.howToUseAndCustomize")}
      >
        <VStack align="stretch" spacing={4} paddingInlineStart={"10px"}>
          <Text fontSize="lg">{t("workspaces.enableOrDisable")}</Text>
          <FormControl>
            <Flex justifyContent="space-between" ml={3}>
              <FormLabel flex={1}>{t("workspaces.enableWorkspaces")}</FormLabel>
              <Controller
                name="enabled"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <Switch
                    colorScheme={"blue"}
                    onChange={(e) => {
                      onOpenEnableWorkspaces();
                      onChange(e.target.checked);
                    }}
                    isChecked={value}
                  />
                )}
              />
            </Flex>
            <FormHelperText mt={0} ml={3} mr={9}>
              {t("workspaces.enableWorkspacesDescription")}
            </FormHelperText>
          </FormControl>

          <Divider />

          <Text fontSize="lg">{t("workspaces.otherSettings")}</Text>
          <FormControl>
            <Flex justifyContent="space-between">
              <FormLabel flex={1} ml={3} mr={9}>
                {t("workspaces.closePopupWhenSelectingWorkspace")}
              </FormLabel>
              <Controller
                name="closePopupAfterClick"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <Switch
                    colorScheme={"blue"}
                    onChange={(e) => onChange(e.target.checked)}
                    isChecked={value}
                  />
                )}
              />
            </Flex>
          </FormControl>

          <FormControl>
            <Flex justifyContent="space-between">
              <FormLabel flex={1} ml={3} mr={9}>
                {t("workspaces.showWorkspaceNameOnToolbar")}
              </FormLabel>
              <Controller
                name="showWorkspaceNameOnToolbar"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <Switch
                    colorScheme={"blue"}
                    onChange={(e) => onChange(e.target.checked)}
                    isChecked={value}
                  />
                )}
              />
            </Flex>
          </FormControl>

          <FormControl>
            <Flex justifyContent="space-between">
              <FormLabel flex={1} ml={3} mr={9}>
                {t("workspaces.manageOnBms")}
              </FormLabel>
              <Controller
                name="manageOnBms"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <Switch
                    colorScheme={"blue"}
                    onChange={(e) => onChange(e.target.checked)}
                    isChecked={value}
                  />
                )}
              />
            </Flex>
            <FormHelperText mt={0} ml={3} mr={9}>
              {t("workspaces.manageOnBmsDescription")}
            </FormHelperText>
          </FormControl>
        </VStack>
      </Card>
    </>
  );
}
