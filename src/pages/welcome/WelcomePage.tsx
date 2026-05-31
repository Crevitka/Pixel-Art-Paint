import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { FolderOpen, Layers3, Plus, Sparkles, X } from 'lucide-react'
import { DEFAULT_PALETTE_PRESETS, type PixelArtProject, type RecentProjectEntry, type StartTemplate } from '@/shared/lib/project'
import { Button } from '@/shared/ui/Button'

type WelcomePageProps = {
  templates: StartTemplate[]
  recentProjects: RecentProjectEntry[]
  onOpenProject: () => void
  onOpenRecentProject: (project: PixelArtProject, name: string) => void
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

const INITIAL_TEMPLATE_FORM: CreateTemplateFormState = {
  title: '',
  description: '',
  width: '32',
  height: '32',
  palettePresetId: DEFAULT_PALETTE_PRESETS[0].id
}

export function WelcomePage({
  templates,
  recentProjects,
  onOpenProject,
  onOpenRecentProject,
  onCreateProject,
  onCreateFromTemplate,
  onSaveTemplate
}: WelcomePageProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCustomTemplateFormOpen, setIsCustomTemplateFormOpen] = useState(false)
  const [templateForm, setTemplateForm] = useState<CreateTemplateFormState>(INITIAL_TEMPLATE_FORM)

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
    setTemplateForm(INITIAL_TEMPLATE_FORM)
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
    const description = templateForm.description.trim() || 'Пользовательский шаблон.'
    const width = Math.max(8, Number(templateForm.width) || 32)
    const height = Math.max(8, Number(templateForm.height) || 32)
    const palettePreset =
      DEFAULT_PALETTE_PRESETS.find((preset) => preset.id === templateForm.palettePresetId) ??
      DEFAULT_PALETTE_PRESETS[0]

    if (!title) return

    onSaveTemplate({
      title,
      description,
      size: { width, height },
      paletteColors: [...palettePreset.colors]
    })

    setIsCustomTemplateFormOpen(false)
    setTemplateForm(INITIAL_TEMPLATE_FORM)
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
                  Pixel Art Paint
                </div>
                <div className="space-y-3">
                  <h1 className="max-w-2xl text-4xl font-black tracking-tight text-slate-900 lg:text-5xl">
                    Начните новый пиксельный проект или откройте уже сохраненный.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-slate-600 lg:text-lg">
                    Стартовая страница позволяет быстро войти в редактор, выбрать шаблон при создании
                    проекта и вернуться к недавним файлам.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={openCreateDialog} variant="primary" className="px-5 py-3">
                  <Layers3 className="h-4 w-4" />
                  Новый проект
                </Button>
                <Button onClick={onOpenProject} variant="secondary" className="px-5 py-3">
                  <FolderOpen className="h-4 w-4" />
                  Открыть проект
                </Button>
              </div>

              {recentProjects.length > 0 ? (
                <div className="space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Недавние файлы</h2>
                    <p className="text-sm text-slate-500">Быстрый повторный вход в последние проекты.</p>
                  </div>
                  <div className="grid gap-3">
                    {recentProjects.map((recentProject) => (
                      <button
                        key={recentProject.id}
                        type="button"
                        onClick={() => onOpenRecentProject(recentProject.project, recentProject.name)}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/70"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{recentProject.name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {new Date(recentProject.updatedAt).toLocaleString('ru-RU')}
                          </div>
                        </div>
                        <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {recentProject.project.canvas.canvasSize.width}x{recentProject.project.canvas.canvasSize.height}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Что нового</h2>
                <p className="text-sm text-slate-500">Стартовый экран теперь чище, а шаблоны открываются только при создании проекта.</p>
              </div>
              <div className="grid gap-3">
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-5">
                  <div className="text-sm font-semibold text-slate-900">Готовые шаблоны</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">
                    Выбор встроенных размеров и палитр теперь находится в окне «Новый проект».
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-5">
                  <div className="text-sm font-semibold text-slate-900">Пользовательские шаблоны</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">
                    {customTemplates.length > 0
                      ? `Сохранено шаблонов: ${customTemplates.length}. Их тоже можно выбрать в окне создания проекта.`
                      : 'Пока нет своих шаблонов. Их можно создать прямо в окне нового проекта.'}
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
                  <h2 className="text-2xl font-bold text-gray-800">Новый проект</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Выберите пустой холст, готовый шаблон или сохраните свой шаблон для будущих работ.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCreateDialog}
                  className="rounded-xl border-2 border-gray-200 bg-white p-2 text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800"
                  aria-label="Закрыть окно создания проекта"
                  title="Закрыть"
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
                        <h3 className="text-base font-semibold text-gray-800">Быстрый старт</h3>
                        <p className="text-sm text-gray-500">Пустой холст без шаблона.</p>
                      </div>
                      <Button onClick={handleCreateBlankProject} variant="primary" className="shrink-0">
                        <Layers3 className="h-4 w-4" />
                        Пустой 32x32
                      </Button>
                    </div>
                  </section>

                  <section className="rounded-2xl border-2 border-gray-200 bg-white p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-800">Готовые шаблоны</h3>
                        <p className="text-sm text-gray-500">Встроенные стартовые размеры и палитры.</p>
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
                        <h3 className="text-base font-semibold text-gray-800">Ваши шаблоны</h3>
                        <p className="text-sm text-gray-500">Сохраненные размеры и палитры.</p>
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
                      <h3 className="text-base font-semibold text-gray-800">Свой шаблон</h3>
                      <p className="text-sm text-gray-500">Сохраните размер и палитру как заготовку.</p>
                    </div>
                    <Button
                      onClick={() => setIsCustomTemplateFormOpen((currentValue) => !currentValue)}
                      variant="secondary"
                      className="shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                      {isCustomTemplateFormOpen ? 'Скрыть' : 'Создать'}
                    </Button>
                  </div>

                  {isCustomTemplateFormOpen ? (
                    <div className="space-y-4">
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-gray-700">Название</span>
                        <input
                          type="text"
                          value={templateForm.title}
                          onChange={(event) => handleTemplateFormChange('title', event.target.value)}
                          placeholder="Например, Персонаж 48x48"
                          className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-primary-500 focus:bg-white"
                        />
                      </label>

                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-gray-700">Описание</span>
                        <textarea
                          value={templateForm.description}
                          onChange={(event) => handleTemplateFormChange('description', event.target.value)}
                          placeholder="Коротко опишите, для чего шаблон."
                          rows={3}
                          className="w-full resize-none rounded-xl border-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-primary-500 focus:bg-white"
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <label className="block space-y-2">
                          <span className="text-sm font-medium text-gray-700">Ширина</span>
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
                          <span className="text-sm font-medium text-gray-700">Высота</span>
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
                        <span className="text-sm font-medium text-gray-700">Палитра</span>
                        <select
                          value={templateForm.palettePresetId}
                          onChange={(event) => handleTemplateFormChange('palettePresetId', event.target.value)}
                          className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:border-primary-500 focus:bg-white"
                        >
                          {DEFAULT_PALETTE_PRESETS.map((preset) => (
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
                        Сохранить шаблон
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm leading-6 text-slate-500">
                      Откройте форму и сохраните свою комбинацию размера и палитры.
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
