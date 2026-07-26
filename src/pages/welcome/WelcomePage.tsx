import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { FolderOpen, Layers3, Plus, Sparkles, X } from 'lucide-react'
import { useI18nContext } from '@/features/i18n'
import { getDefaultPalettePresets, type RecentProjectEntry, type StartTemplate } from '@/shared/lib/project'
import { Button } from '@/shared/ui/Button'

type WelcomePageProps = {
  templates: StartTemplate[]
  recentProjects: RecentProjectEntry[]
  onOpenProject: () => void
  onOpenRecentProject: (entry: RecentProjectEntry) => void
  onCreateProject: () => void
  onCreateFromTemplate: (template: StartTemplate) => void
  onSaveTemplate: (template: Omit<StartTemplate, 'id' | 'isBuiltIn'>) => void
}

type CreateTemplateFormState = {
  title: string
  description: string
  width: string
  height: string
  palettePresetId: string
}

const createInitialTemplateForm = (palettePresetId: string): CreateTemplateFormState => ({
  title: '',
  description: '',
  width: '32',
  height: '32',
  palettePresetId
})

export function WelcomePage({
  templates,
  recentProjects,
  onOpenProject,
  onOpenRecentProject,
  onCreateProject,
  onCreateFromTemplate,
  onSaveTemplate
}: WelcomePageProps) {
  const { locale, t } = useI18nContext()
  const defaultPalettePresets = useMemo(() => getDefaultPalettePresets(locale), [locale])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCustomTemplateFormOpen, setIsCustomTemplateFormOpen] = useState(false)
  const [templateForm, setTemplateForm] = useState<CreateTemplateFormState>(() =>
    createInitialTemplateForm(defaultPalettePresets[0].id)
  )

  const builtInTemplates = useMemo(
    () => templates.filter((template) => template.isBuiltIn),
    [templates]
  )
  const customTemplates = useMemo(
    () => templates.filter((template) => !template.isBuiltIn),
    [templates]
  )

  const openCreateDialog = () => {
    setIsCreateDialogOpen(true)
  }

  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false)
    setIsCustomTemplateFormOpen(false)
    setTemplateForm(createInitialTemplateForm(defaultPalettePresets[0].id))
  }

  const handleCreateBlankProject = () => {
    onCreateProject()
    closeCreateDialog()
  }

  const handleCreateFromTemplate = (template: StartTemplate) => {
    onCreateFromTemplate(template)
    closeCreateDialog()
  }

  const handleTemplateFormChange = <K extends keyof CreateTemplateFormState>(
    key: K,
    value: CreateTemplateFormState[K]
  ) => {
    setTemplateForm((currentForm) => ({
      ...currentForm,
      [key]: value
    }))
  }

  const handleSaveTemplate = () => {
    const title = templateForm.title.trim()
    const description = templateForm.description.trim() || t('welcome.customTemplate.fallbackDescription')
    const width = Math.max(8, Number(templateForm.width) || 32)
    const height = Math.max(8, Number(templateForm.height) || 32)
    const palettePreset =
      defaultPalettePresets.find((preset) => preset.id === templateForm.palettePresetId) ??
      defaultPalettePresets[0]

    if (!title) return

    onSaveTemplate({
      title,
      description,
      size: { width, height },
      paletteColors: [...palettePreset.colors]
    })

    setIsCustomTemplateFormOpen(false)
    setTemplateForm(createInitialTemplateForm(defaultPalettePresets[0].id))
  }

  return (
    <>
      <motion.div
        className="max-w-7xl mx-auto h-screen overflow-hidden p-6 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="relative w-full overflow-hidden rounded-[32px] border border-white/50 bg-white/80 p-8 shadow-[0_30px_120px_rgba(15,23,42,0.18)] backdrop-blur-xl lg:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.14),_transparent_28%)]" />
          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700">
                  <Sparkles className="h-4 w-4" />
                  {t('welcome.badge')}
                </div>
                <div className="space-y-3">
                  <h1 className="max-w-2xl text-4xl font-black tracking-tight text-slate-900 lg:text-5xl">
                    {t('welcome.title')}
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-slate-600 lg:text-lg">
                    {t('welcome.subtitle')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={openCreateDialog} variant="primary" className="px-5 py-3">
                  <Layers3 className="h-4 w-4" />
                  {t('welcome.newProject')}
                </Button>
                <Button onClick={onOpenProject} variant="secondary" className="px-5 py-3">
                  <FolderOpen className="h-4 w-4" />
                  {t('welcome.openProject')}
                </Button>
              </div>

              {recentProjects.length > 0 ? (
                <div className="space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{t('welcome.recent.title')}</h2>
                    <p className="text-sm text-slate-500">{t('welcome.recent.subtitle')}</p>
                  </div>
                  <div className="grid gap-3">
                    {recentProjects.map((recentProject) => (
                      <button
                        key={recentProject.id}
                        type="button"
                        onClick={() => onOpenRecentProject(recentProject)}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/70"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{recentProject.name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {new Date(recentProject.updatedAt).toLocaleString('ru-RU')}
                          </div>
                        </div>
                        <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {recentProject.canvasSize.width}x{recentProject.canvasSize.height}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{t('welcome.whatsNew')}</h2>
                <p className="text-sm text-slate-500">{t('welcome.whatsNew.subtitle')}</p>
              </div>
              <div className="grid gap-3">
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-5">
                  <div className="text-sm font-semibold text-slate-900">{t('welcome.templates.title')}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">
                    {t('welcome.templates.description')}
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-5">
                  <div className="text-sm font-semibold text-slate-900">{t('welcome.customTemplates.title')}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">
                    {customTemplates.length > 0
                      ? t('welcome.customTemplates.count', { count: customTemplates.length })
                      : t('welcome.customTemplates.empty')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {isCreateDialogOpen ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={closeCreateDialog}
        >
          <motion.div
            className="glass-effect flex w-full max-w-5xl max-h-[calc(100vh-32px)] flex-col rounded-3xl shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-gray-200/70 px-6 py-5 md:px-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">{t('welcome.dialog.title')}</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {t('welcome.dialog.description')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCreateDialog}
                  className="rounded-xl border-2 border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800"
                  aria-label={t('welcome.dialog.closeAria')}
                  title={t('common.close')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto px-6 py-5 md:px-7">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="space-y-6">
                  <section className="rounded-2xl border-2 border-gray-200 bg-white p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-800">{t('welcome.quickStart.title')}</h3>
                        <p className="text-sm text-gray-500">{t('welcome.quickStart.description')}</p>
                      </div>
                      <Button onClick={handleCreateBlankProject} variant="primary" className="shrink-0">
                        <Layers3 className="h-4 w-4" />
                        {t('welcome.blankProject')}
                      </Button>
                    </div>
                  </section>

                  <section className="rounded-2xl border-2 border-gray-200 bg-white p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-800">{t('welcome.builtInTemplates.title')}</h3>
                        <p className="text-sm text-gray-500">{t('welcome.builtInTemplates.description')}</p>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {builtInTemplates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => handleCreateFromTemplate(template)}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/70"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <div className="text-base font-semibold text-slate-900">{template.title}</div>
                              <div className="text-sm leading-6 text-slate-600">{template.description}</div>
                            </div>
                            <div className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {template.size.width}x{template.size.height}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>

                  {customTemplates.length > 0 ? (
                    <section className="rounded-2xl border-2 border-gray-200 bg-white p-4 space-y-4">
                      <div>
                        <h3 className="text-base font-semibold text-gray-800">{t('welcome.yourTemplates.title')}</h3>
                        <p className="text-sm text-gray-500">{t('welcome.yourTemplates.description')}</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {customTemplates.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => handleCreateFromTemplate(template)}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/70"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1">
                                <div className="text-base font-semibold text-slate-900">{template.title}</div>
                                <div className="text-sm leading-6 text-slate-600">{template.description}</div>
                              </div>
                              <div className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                {template.size.width}x{template.size.height}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>

                <section className="rounded-2xl border-2 border-gray-200 bg-white p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-800">{t('welcome.ownTemplate.title')}</h3>
                      <p className="text-sm text-gray-500">{t('welcome.ownTemplate.description')}</p>
                    </div>
                    <Button
                      onClick={() => setIsCustomTemplateFormOpen((currentValue) => !currentValue)}
                      variant="secondary"
                      className="shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                      {isCustomTemplateFormOpen ? t('welcome.ownTemplate.toggleHide') : t('welcome.ownTemplate.toggleShow')}
                    </Button>
                  </div>

                  {isCustomTemplateFormOpen ? (
                    <div className="space-y-4">
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-gray-700">{t('common.name')}</span>
                        <input
                          type="text"
                          value={templateForm.title}
                          onChange={(event) => handleTemplateFormChange('title', event.target.value)}
                          placeholder={t('welcome.template.namePlaceholder')}
                          className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-primary-500 focus:bg-white"
                        />
                      </label>

                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-gray-700">{t('common.description')}</span>
                        <textarea
                          value={templateForm.description}
                          onChange={(event) => handleTemplateFormChange('description', event.target.value)}
                          placeholder={t('welcome.template.descriptionPlaceholder')}
                          rows={3}
                          className="w-full resize-none rounded-xl border-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-primary-500 focus:bg-white"
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <label className="block space-y-2">
                          <span className="text-sm font-medium text-gray-700">{t('common.width')}</span>
                          <input
                            type="number"
                            min="8"
                            max="512"
                            value={templateForm.width}
                            onChange={(event) => handleTemplateFormChange('width', event.target.value)}
                            className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-primary-500 focus:bg-white"
                          />
                        </label>
                        <label className="block space-y-2">
                          <span className="text-sm font-medium text-gray-700">{t('common.height')}</span>
                          <input
                            type="number"
                            min="8"
                            max="512"
                            value={templateForm.height}
                            onChange={(event) => handleTemplateFormChange('height', event.target.value)}
                            className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-primary-500 focus:bg-white"
                          />
                        </label>
                      </div>

                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-gray-700">{t('common.palette')}</span>
                        <select
                          value={templateForm.palettePresetId}
                          onChange={(event) => handleTemplateFormChange('palettePresetId', event.target.value)}
                          className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-primary-500 focus:bg-white"
                        >
                          {defaultPalettePresets.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <Button
                        onClick={handleSaveTemplate}
                        variant="primary"
                        className="w-full justify-center"
                        disabled={!templateForm.title.trim()}
                      >
                        <Plus className="h-4 w-4" />
                        {t('welcome.template.save')}
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm leading-6 text-slate-500">
                      {t('welcome.template.hint')}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </>
  )
}
